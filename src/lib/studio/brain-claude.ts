// The real brain, powered by your Claude subscription via the local `claude`
// CLI (Claude Code). No API key, no metered bill — it runs on the machine
// that's signed in as you (your Mac in dev). On a host without the CLI (e.g.
// Vercel), this throws and the caller falls back to the stub until the metered
// API brain is wired for production.
//
// It's a pure text→JSON call: all tools are disabled and MCP is off, so Claude
// can't touch the filesystem — it only proposes new values for fenced fields.
// The store re-checks the fence before writing regardless.

import { execFile } from "node:child_process";
import { editableFields } from "./schema";
import type { Edit } from "./store";
import type { Proposal, PageContext } from "./brain";

const SCHEMA = JSON.stringify({
	type: "object",
	properties: {
		reply: { type: "string" },
		edits: {
			type: "array",
			items: {
				type: "object",
				properties: { path: { type: "string" }, to: { type: "string" } },
				required: ["path", "to"],
			},
		},
	},
	required: ["reply", "edits"],
});

function getPath(obj: any, dotPath: string): unknown {
	return dotPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function buildPrompt(message: string, content: any, ctx: PageContext): string {
	const fields = editableFields(content)
		.map((f) => `- ${f.path} — "${String(getPath(content, f.path) ?? "")}"${f.hint ? ` (${f.hint})` : ""}`)
		.join("\n");

	return [
		"You are the content editor for the New Life Grand Rapids church website.",
		"You do NOT have file access and you are NOT writing code. You only propose new TEXT for a fixed set of content fields. Never ask for a file path or location.",
		"",
		"Editable fields (path — current value):",
		fields,
		"",
		`The staff member is viewing: ${ctx.page || "the site"}.`,
		`They said: "${message}"`,
		"",
		"Respond as JSON with:",
		"- reply: one warm, brief sentence describing what you changed — or a short clarifying question if you genuinely can't tell which field they mean.",
		"- edits: an array of {path, to} using ONLY the exact paths listed above, with `to` set to the new text. Use an empty array if you're only asking a question.",
		"Never invent a path that isn't in the list. Keep the church's warm, reverent tone.",
	].join("\n");
}

export async function proposeEditsViaClaude(
	message: string,
	content: any,
	ctx: PageContext,
): Promise<Proposal> {
	const model = process.env.STUDIO_MODEL || "sonnet";
	const prompt = buildPrompt(message, content, ctx);

	const stdout = await new Promise<string>((resolve, reject) => {
		const child = execFile(
			"claude",
			[
				"-p", prompt,
				"--output-format", "json",
				"--json-schema", SCHEMA,
				"--allowedTools", "",
				"--strict-mcp-config",
				"--no-session-persistence",
				"--model", model,
			],
			{ timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
			(err, out) => (err ? reject(err) : resolve(out)),
		);
		child.on("error", reject);
	});

	const envelope = JSON.parse(stdout);
	const out = envelope.structured_output;
	if (!out || !Array.isArray(out.edits)) {
		throw new Error("Claude returned no structured output.");
	}

	// Keep only fenced paths, and fill `from` from the live content for display.
	const allowed = new Set(editableFields(content).map((f) => f.path));
	const edits: Edit[] = out.edits
		.filter((e: any) => e && allowed.has(e.path))
		.map((e: any) => ({ path: e.path, from: getPath(content, e.path), to: String(e.to) }));

	return { reply: String(out.reply || "Here's the change — review and Publish."), edits };
}
