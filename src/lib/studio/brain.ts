// The BRAIN — turns a staff member's plain-English message into proposed edits.
//
// This is the seam where Claude plugs in. Right now it runs a rule-based STUB
// so the whole editor works with no API key: it figures out which fenced field
// you mean and what to set it to. When the real key lands, only proposeEdits()
// changes — it will call the Claude API with the editable fields as tools and
// return the SAME { reply, edits } shape. Nothing downstream changes.

import { editableFields, type EditableField } from "./schema";
import type { Edit } from "./store";

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

export async function proposeEdits(
	message: string,
	content: any,
	_context: PageContext = {},
): Promise<Proposal> {
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

// ── When the API key is ready, proposeEdits() becomes roughly: ───────────────
//   const tools = editableFields(content).map(fieldToTool)
//   const res = await anthropic.messages.create({ model, tools, system, messages })
//   → map Claude's tool calls to Edit[] (each already fence-checked) and return
//     { reply: res.text, edits }.  The store still re-verifies every path.
