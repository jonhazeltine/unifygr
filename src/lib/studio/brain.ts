// The BRAIN — turns a staff member's plain-English message into proposed edits.
//
// Hosted Studio uses the Anthropic API and a forced structured tool response.
// Local development keeps the signed-in Claude CLI path. If neither is
// configured, the narrow rule-based editor still handles simple field edits.

import { editableFields, type EditableField } from "./schema";
import type { Edit } from "./store";
import { isCloudflareWorker } from "../runtime";
import { callAnthropicTool } from "./anthropic";

export type Proposal = {
	/** conversational reply shown in the chat */
	reply: string;
	/** proposed edits — NOT yet applied; the user reviews then publishes */
	edits: Edit[];
};

function getPath(obj: any, dotPath: string): unknown {
	return dotPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

const STOP = new Set([
	"the", "a", "an", "to", "into", "set", "change", "make", "update", "edit",
	"please", "our", "my", "it", "is", "be", "should", "read", "say", "of", "and",
	"new", "value", "field", "for", "on", "in", "as", "with",
]);

/** Score how well a message targets a given field. */
function scoreField(msg: string, field: EditableField, content: any): number {
	const hay = `${field.label} ${field.path}`.toLowerCase();
	const value = String(getPath(content, field.path) ?? "").toLowerCase();
	const words = msg
		.toLowerCase()
		.replace(/["'“”‘’]/g, " ")
		.split(/[^a-z0-9]+/)
		.filter((w) => w && !STOP.has(w));

	let score = 0;
	for (const w of words) {
		if (hay.includes(w)) score += 2;
		if (value && value.includes(w)) score += 1;
	}
	// Strong phrase matches.
	const label = field.label.toLowerCase();
	if (msg.toLowerCase().includes(label)) score += 4;
	return score;
}

/** Pull the intended new value out of the message. */
function extractValue(msg: string): string | null {
	// 1) Anything in quotes (straight or smart) wins.
	const q = msg.match(/["'“‘]([^"'”’]+)["'”’]/);
	if (q) return q[1].trim();

	// 2) "... to X" / "... into X" / "...: X"
	const to = msg.match(/\b(?:to|into|as|=|:)\s+(.+)$/i);
	if (to) return to[1].trim().replace(/[.\s]+$/, "");

	return null;
}

export type PageContext = { path?: string; page?: string };

// Dispatch: use the real brain (your Claude subscription via the CLI) by
// default; fall back to the rule-based stub if the CLI isn't available
// (e.g. on Vercel) or errors. Set STUDIO_BRAIN=stub to force the stub.
export async function proposeEdits(
	message: string,
	content: any,
	context: PageContext = {},
): Promise<Proposal> {
	if (isCloudflareWorker() && process.env.ANTHROPIC_API_KEY) {
		return proposeEditsViaApi(message, content, context);
	}
	if (import.meta.env?.DEV && process.env.STUDIO_BRAIN !== "stub") {
		try {
			const { proposeEditsViaClaude } = await import("./brain-claude");
			return await proposeEditsViaClaude(message, content, context);
		} catch {
			// CLI missing or failed — fall through to the stub.
		}
	}
	return proposeEditsStub(message, content);
}

async function proposeEditsViaApi(message: string, content: any, context: PageContext): Promise<Proposal> {
	const fields = editableFields(content);
	const prompt = [
		"You edit the New Life Grand Rapids community website's approved text fields.",
		"Return only changes to the exact fields listed below. Ask a brief clarifying question and return no edits if the request is unclear.",
		...fields.map((field) => `- ${field.path}: ${JSON.stringify(String(getPath(content, field.path) ?? ""))}${field.hint ? ` (${field.hint})` : ""}`),
		`Current page: ${context.page || context.path || "the site"}`,
		`Staff request: ${JSON.stringify(message)}`,
	].join("\n");
	const output = await callAnthropicTool({
		prompt,
		toolName: "return_edits",
		toolDescription: "Return a brief reply and proposed edits to approved fields.",
		inputSchema: {
			type: "object",
			properties: {
				reply: { type: "string" },
				edits: { type: "array", items: { type: "object", properties: { path: { type: "string" }, to: { type: "string" } }, required: ["path", "to"] } },
			},
			required: ["reply", "edits"],
		},
		maxTokens: 2048,
	}) as { reply?: unknown; edits?: unknown };
	if (!output || typeof output !== "object" || !Array.isArray(output.edits)) throw new Error("Studio AI returned no proposal.");
	const allowed = new Set(fields.map((field) => field.path));
	const edits: Edit[] = (output.edits as any[])
		.filter((edit: any) => edit && typeof edit.path === "string" && typeof edit.to === "string" && allowed.has(edit.path))
		.map((edit: any) => ({ path: edit.path, from: getPath(content, edit.path), to: edit.to }));
	const reply = typeof output.reply === "string" && output.reply.trim()
		? output.reply
		: "Here's the change — review and Publish.";
	return { reply, edits };
}

function proposeEditsStub(message: string, content: any): Proposal {
	const fields = editableFields(content);
	const msg = message.trim();

	// Simple "what can I change?" intent.
	if (/\b(what|which|list|show|help|can i (change|edit))\b/i.test(msg) && !extractValue(msg)) {
		const groups = [...new Set(fields.map((f) => f.group))];
		return {
			reply:
				"Right now you can edit: " +
				groups.join(", ") +
				". Try something like: change the tagline to \"Come as you are.\"",
			edits: [],
		};
	}

	// Find the best-matching field.
	const ranked = fields
		.map((f) => ({ f, s: scoreField(msg, f, content) }))
		.sort((a, b) => b.s - a.s);
	const best = ranked[0];

	if (!best || best.s === 0) {
		return {
			reply:
				"I'm not sure which part of the site you mean. Tell me the field — for " +
				"example: \"change the service time to Sundays at 9am.\"",
			edits: [],
		};
	}

	const value = extractValue(msg);
	if (value == null) {
		return {
			reply: `I think you mean the ${best.f.label.toLowerCase()}. What should it say? Put the new wording in quotes.`,
			edits: [],
		};
	}

	const current = getPath(content, best.f.path);
	if (String(current) === value) {
		return { reply: `The ${best.f.label.toLowerCase()} already says that — nothing to change.`, edits: [] };
	}

	return {
		reply: `Here's the change to your ${best.f.label.toLowerCase()} — review it and hit Publish when it looks right.`,
		edits: [{ path: best.f.path, from: current, to: value }],
	};
}
