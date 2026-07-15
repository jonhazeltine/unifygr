// The content store + version history for the AI editor.
//
// Stage 1 backend: the local filesystem. Reads and writes content/site.json,
// and snapshots every change under .studio/history/ so any edit is one click
// to undo. This module is the ONLY thing that writes content, and it refuses
// to write any path outside the fence (see schema.ts).
//
// Writes are SURGICAL: we edit the raw JSON text in place, changing only the
// one value, so a one-word edit produces a one-line diff and the file keeps
// its hand-authored formatting. Undo restores the exact prior bytes.
//
// Later, a GitHub-backed implementation swaps in behind this same interface
// (readContent / applyEdits / undo) so the site can be edited in production
// without a filesystem. Nothing that calls this module needs to change.

import { promises as fs } from "node:fs";
import path from "node:path";
import { isEditable } from "./schema";

const ROOT = process.cwd();
const CONTENT_PATH = path.join(ROOT, "content", "site.json");
const HISTORY_DIR = path.join(ROOT, ".studio", "history");

export type Edit = {
	path: string;
	/** value before the edit (for display + verification) */
	from?: unknown;
	/** value to set */
	to: unknown;
};

export type Version = {
	id: string;
	at: string; // ISO timestamp
	summary: string;
	edits: Edit[];
};

async function readRaw(): Promise<string> {
	return fs.readFile(CONTENT_PATH, "utf8");
}

export async function readContent(): Promise<any> {
	return JSON.parse(await readRaw());
}

function getPath(obj: any, dotPath: string): unknown {
	return dotPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function reEscape(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The inner (already backslash-escaped) form a string takes inside JSON text.
function jsonInner(value: unknown): string {
	const s = JSON.stringify(String(value));
	return s.slice(1, -1);
}

/**
 * Replace a single "key": "oldValue" leaf in the raw JSON with a new value,
 * touching nothing else. Anchoring on BOTH the key and the exact current value
 * pins the right occurrence even when a key name (e.g. "verb") repeats.
 */
function replaceLeaf(raw: string, leafKey: string, oldValue: unknown, newValue: unknown): string {
	const re = new RegExp(
		`("${reEscape(leafKey)}"\\s*:\\s*")${reEscape(jsonInner(oldValue))}(")`,
	);
	if (!re.test(raw)) {
		throw new Error(`Could not locate "${leafKey}" with its current value to update.`);
	}
	const replacement = "$1" + jsonInner(newValue).replace(/\$/g, "$$$$") + "$2";
	return raw.replace(re, replacement);
}

async function snapshotRaw(version: Version, raw: string): Promise<void> {
	await fs.mkdir(HISTORY_DIR, { recursive: true });
	await fs.writeFile(
		path.join(HISTORY_DIR, `${version.id}.json`),
		JSON.stringify({ version, raw }),
		"utf8",
	);
}

async function listVersionIds(): Promise<string[]> {
	try {
		const files = await fs.readdir(HISTORY_DIR);
		return files
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.replace(/\.json$/, ""))
			.sort(); // ids are timestamp-prefixed, so lexical sort == chronological
	} catch {
		return [];
	}
}

/**
 * Apply a set of edits after re-checking every path against the fence, editing
 * the raw text surgically. Snapshots the exact PRE-edit bytes so undo restores
 * them verbatim. Returns the new content and the version record.
 */
export async function applyEdits(
	edits: Edit[],
	summary: string,
	clock: () => Date = () => new Date(),
): Promise<{ content: any; version: Version }> {
	const rawBefore = await readRaw();
	const before = JSON.parse(rawBefore);

	// Re-verify the fence at write time — never trust the caller.
	for (const edit of edits) {
		if (!isEditable(before, edit.path)) {
			throw new Error(`Refused: "${edit.path}" is not an editable field.`);
		}
	}

	const now = clock();
	const id = now.toISOString().replace(/[:.]/g, "-");

	// Snapshot the exact bytes we're about to leave, so undo returns to them.
	await snapshotRaw({ id, at: now.toISOString(), summary, edits }, rawBefore);

	let raw = rawBefore;
	const applied: Edit[] = [];
	for (const edit of edits) {
		const leafKey = edit.path.split(".").pop() as string;
		const current = getPath(before, edit.path);
		raw = replaceLeaf(raw, leafKey, current, edit.to);
		applied.push({ path: edit.path, from: current, to: edit.to });
	}

	// Parse-check before committing the write: never leave invalid JSON on disk.
	const after = JSON.parse(raw);
	await fs.writeFile(CONTENT_PATH, raw, "utf8");

	return { content: after, version: { id, at: now.toISOString(), summary, edits: applied } };
}

/** Restore the most recent snapshot (undo the last apply), byte-for-byte. */
export async function undo(): Promise<{ content: any; restoredFrom: string } | null> {
	const ids = await listVersionIds();
	const lastId = ids.pop();
	if (!lastId) return null;

	const saved = JSON.parse(
		await fs.readFile(path.join(HISTORY_DIR, `${lastId}.json`), "utf8"),
	);
	await fs.writeFile(CONTENT_PATH, saved.raw, "utf8");

	// Consume the snapshot so repeated undo walks further back.
	await fs.rm(path.join(HISTORY_DIR, `${lastId}.json`));

	return { content: JSON.parse(saved.raw), restoredFrom: lastId };
}

export async function historyCount(): Promise<number> {
	return (await listVersionIds()).length;
}
