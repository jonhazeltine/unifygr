// The free-form CMS agent. Staff talk to it; it edits the site's REAL files
// (pages, layouts, nav, content) via the local `claude` CLI (Claude Code) on
// your subscription. Two hard rails make it safe:
//
//   1. Protected paths — config, the editor's own code, and package files are
//      reverted if the agent touches them (enforced here, not just asked).
//   2. Build gate — after every change we run the build; if it fails, the whole
//      change is rolled back, so a broken site can never result.
//
// Every change is snapshotted against a git baseline for one-click undo. Runs
// only where the CLI is signed in as you (your Mac); on a host without it the
// route surfaces a clear message.

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PageContext } from "./brain";

const ROOT = process.cwd();
const HISTORY_DIR = path.join(ROOT, ".studio", "agent-history");

// Files/dirs the agent must never change. Anything matching is reverted.
const PROTECTED = [
	/^astro\.config\./, /^package(-lock)?\.json$/, /^tsconfig\.json$/,
	/^vercel\.json$/, /^wrangler\.json$/, /^worker-configuration\.d\.ts$/,
	/^\.gitignore$/, /^\.git\//, /^node_modules\//, /^\.studio\//, /^dist\//,
	/^\.vercel\//, /^tina\//,
	/^src\/lib\/studio\//, /^src\/pages\/api\/studio\//,
	/^src\/components\/StudioDock\.astro$/,
];

function isProtected(file: string): boolean {
	return PROTECTED.some((re) => re.test(file));
}

function git(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile("git", args, { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 }, (err, out) =>
			err ? reject(err) : resolve(out.toString()),
		);
	});
}

// A commit-ish representing the current tree state, without disturbing it.
async function baseline(): Promise<string> {
	const sha = (await git(["stash", "create"]).catch(() => "")).trim();
	return sha || "HEAD";
}

async function trackedChangedVsBase(base: string): Promise<string[]> {
	const out = await git(["diff", "--name-only", base, "--"]).catch(() => "");
	return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

async function untracked(): Promise<string[]> {
	const out = await git(["ls-files", "--others", "--exclude-standard"]).catch(() => "");
	return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

async function existsInBase(base: string, file: string): Promise<boolean> {
	try { await git(["cat-file", "-e", `${base}:${file}`]); return true; } catch { return false; }
}

// Restore one file to its baseline state (revert edits / restore a deletion),
// or delete it if it didn't exist at the baseline (a file the agent created).
async function restoreFile(base: string, file: string): Promise<void> {
	if (await existsInBase(base, file)) {
		await git(["checkout", base, "--", file]).catch(() => {});
	} else {
		await fs.rm(path.join(ROOT, file), { force: true }).catch(() => {});
	}
}

async function restoreMany(base: string, files: string[]): Promise<void> {
	for (const f of files) await restoreFile(base, f);
}

// Everything the agent touched: tracked files that differ from the baseline,
// plus untracked files that did NOT already exist before the run. Capturing the
// pre-run untracked set is essential — otherwise unrelated untracked files
// (e.g. work-in-progress source) would be mistaken for the agent's own edits.
async function agentChanges(base: string, untrackedBefore: Set<string>): Promise<string[]> {
	const tracked = await trackedChangedVsBase(base);
	const created = (await untracked()).filter((f) => !untrackedBefore.has(f));
	return [...new Set([...tracked, ...created])];
}

function buildInstruction(message: string, ctx: PageContext): string {
	return [
		"You are the site manager for the New Life Grand Rapids website (an Astro site).",
		"A staff member is editing the live site by talking to you. Fulfill their request by editing the project's files directly with your file tools.",
		"",
		`The staff member is currently viewing: ${ctx.page || "the site"} (${ctx.path || "/"}).`,
		"Page sources live in src/pages/*.astro (homepage = src/pages/index.astro; most interior pages use src/layouts/Interior.astro). The shared header/nav and footer are in src/layouts/Interior.astro (and the homepage's own header in src/pages/index.astro). Shared text/data is in src/data/site.ts and content/site.json.",
		"",
		"You MAY edit: src/pages/** (except src/pages/api/**), src/layouts/**, src/components/** (except StudioDock.astro), src/data/**, src/styles/**, content/**. You may add, rename, or move page files and update the navigation and links to match.",
		"You MUST NOT modify: any config (astro.config.*, package.json, tsconfig, vercel.json, wrangler.json), the editor's own code (src/lib/studio/**, src/pages/api/studio/**, src/components/StudioDock.astro), or tina/**. Do not run shell commands.",
		"",
		"Preserve the site's existing visual style, tone, and structure. Make the smallest change that fulfills the request, and keep the code valid so the site still builds.",
		"",
		`Request: "${message}"`,
		"",
		"When done, reply with 1–2 warm sentences in plain English telling the staff member what you changed. No code in your reply.",
	].join("\n");
}

async function runClaude(instruction: string): Promise<string> {
	const model = process.env.STUDIO_MODEL || "sonnet";
	const stdout = await new Promise<string>((resolve, reject) => {
		execFile(
			"claude",
			[
				"-p", instruction,
				"--output-format", "json",
				"--allowedTools", "Read", "Edit", "Write", "Glob", "Grep",
				"--strict-mcp-config",
				"--no-session-persistence",
				"--model", model,
			],
			{ cwd: ROOT, timeout: 240_000, maxBuffer: 20 * 1024 * 1024 },
			(err, out) => (err ? reject(err) : resolve(out.toString())),
		);
	});
	const env = JSON.parse(stdout);
	return String(env.result || "Done.");
}

function tryBuild(): Promise<{ ok: boolean; err?: string }> {
	return new Promise((resolve) => {
		execFile(
			"npm", ["run", "build"],
			{ cwd: ROOT, timeout: 180_000, maxBuffer: 40 * 1024 * 1024 },
			(err, _out, stderr) => {
				if (!err) return resolve({ ok: true });
				const text = (stderr?.toString() || (err as any).message || "").trim();
				const lines = text.split("\n").filter(Boolean);
				resolve({ ok: false, err: lines.slice(-6).join("\n").slice(0, 800) });
			},
		);
	});
}

export type AgentResult = {
	ok: boolean;
	reply: string;
	changed: string[];
	error?: string;
};

export async function runAgent(message: string, ctx: PageContext): Promise<AgentResult> {
	const base = await baseline();
	const untrackedBefore = new Set(await untracked());

	let summary: string;
	try {
		summary = await runClaude(buildInstruction(message, ctx));
	} catch (e) {
		// The CLI is missing or errored — roll back anything partial and report.
		await restoreMany(base, await agentChanges(base, untrackedBefore));
		return {
			ok: false,
			reply: "I couldn't reach Claude to make that change on this machine.",
			changed: [],
			error: (e as Error).message.slice(0, 300),
		};
	}

	const changed = await agentChanges(base, untrackedBefore);

	// Rail 1: revert anything the agent touched that it shouldn't have.
	const violations = changed.filter(isProtected);
	if (violations.length) await restoreMany(base, violations);
	const effective = changed.filter((f) => !isProtected(f));

	if (effective.length === 0) {
		return { ok: true, reply: summary, changed: [] };
	}

	// Rail 2: build gate — if the change breaks the build, roll it ALL back.
	const build = await tryBuild();
	if (!build.ok) {
		await restoreMany(base, effective);
		return {
			ok: false,
			reply: "I made that change, but it would have broken the site — so I undid it. Want to try wording it differently?",
			changed: [],
			error: build.err,
		};
	}

	// Snapshot for undo.
	await fs.mkdir(HISTORY_DIR, { recursive: true });
	const id = new Date().toISOString().replace(/[:.]/g, "-");
	await fs.writeFile(
		path.join(HISTORY_DIR, `${id}.json`),
		JSON.stringify({ id, base, files: effective, summary }),
		"utf8",
	);

	return { ok: true, reply: summary, changed: effective };
}

async function listSnapshots(): Promise<string[]> {
	try {
		return (await fs.readdir(HISTORY_DIR))
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.replace(/\.json$/, ""))
			.sort();
	} catch { return []; }
}

export async function undoAgent(): Promise<{ ok: boolean; reply: string }> {
	const ids = await listSnapshots();
	const last = ids.pop();
	if (!last) return { ok: false, reply: "Nothing to undo." };

	const snap = JSON.parse(await fs.readFile(path.join(HISTORY_DIR, `${last}.json`), "utf8"));
	await restoreMany(snap.base, snap.files);
	await fs.rm(path.join(HISTORY_DIR, `${last}.json`)).catch(() => {});

	return { ok: true, reply: "Reverted the last change. Reload the page to see it." };
}

export async function agentHistoryCount(): Promise<number> {
	return (await listSnapshots()).length;
}
