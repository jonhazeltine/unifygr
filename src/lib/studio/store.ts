// Runtime store for the fenced Studio fields. Repository content/site.json is a
// seed; hosted publishing creates an immutable Blob revision and moves the
// published pointer, without committing or rebuilding the site.

import seed from "../../../content/site.json";
import { isEditable } from "./schema";
import { ContentConflict, publish, readPublished, readRevision, restorePublished, revisions, type RuntimeLocals } from "./runtime-content";

const KEY = "studio/site/published.json";

export type Edit = { path: string; from?: unknown; to: unknown };
export type Version = { id: string; at: string; summary: string; edits: Edit[] };

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function getPath(obj: any, dotPath: string): unknown {
	return dotPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
function setPath(obj: any, dotPath: string, value: unknown): void {
	const parts = dotPath.split(".");
	let target = obj;
	for (const part of parts.slice(0, -1)) target = target[part];
	target[parts[parts.length - 1]] = value;
}

export async function readContent(locals?: RuntimeLocals): Promise<any> {
	return (await readPublished(KEY, seed, locals)).value;
}

export async function readContentSnapshot(locals?: RuntimeLocals): Promise<{ content: any; version: string }> {
	const stored = await readPublished(KEY, seed, locals);
	return { content: stored.value, version: stored.version };
}

export async function contentVersion(locals?: RuntimeLocals): Promise<string> {
	return (await readPublished(KEY, seed, locals)).version;
}

export async function applyEdits(
	edits: Edit[], summary: string, expectedVersion?: string, locals?: RuntimeLocals,
): Promise<{ content: any; version: Version }> {
	const current = await readPublished(KEY, seed, locals);
	if (expectedVersion && expectedVersion !== current.version) {
		throw new ContentConflict();
	}
	const content = clone(current.value);
	const applied: Edit[] = [];
	for (const edit of edits) {
		if (!isEditable(content, edit.path)) throw new Error(`Refused: "${edit.path}" is not an editable field.`);
		const from = getPath(content, edit.path);
		setPath(content, edit.path, edit.to);
		applied.push({ path: edit.path, from, to: edit.to });
	}
	const saved = await publish(KEY, content, seed, current.version, locals);
	return { content, version: { id: saved.version, at: saved.publishedAt, summary, edits: applied } };
}

// The previous revision remains immutable. The explicit version route will use
// this list for rollback; no history is erased by an ordinary publish.
export async function historyCount(locals?: RuntimeLocals): Promise<number> {
	return (await revisions(KEY, locals)).length;
}

export async function undo(locals?: RuntimeLocals): Promise<{ content: any; restoredFrom: string; version: string } | null> {
	const current = await readPublished(KEY, seed, locals);
	const latest = await readRevision<any>(`studio/revisions/${KEY}/${current.version}.json`, locals);
	if (!latest?.previousVersion) return null;
	const prior = await readRevision<any>(`studio/revisions/${KEY}/${latest.previousVersion}.json`, locals);
	if (!prior) return null;
	await restorePublished(KEY, prior, current.version, locals);
	return { content: prior.value, restoredFrom: latest.previousVersion, version: prior.version };
}
