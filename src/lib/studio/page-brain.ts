// The full-PAGE brain — turns a plain-English staff request into a rewritten
// Page Builder document (any heading, text, button, link, or block prop; plus
// reordering and adding/removing EXISTING block types). Shared by the
// full-screen builder's AI bar (page-ai.ts) and the on-page Studio dock chat
// (chat.ts), so both surfaces reason about pages identically.
//
// Production brain: the Anthropic API directly (metered key, forced tool
// call — schema-validated output, no text parsing). Local dev without an API
// key falls back to the signed-in `claude` CLI (your subscription).
//
// This never writes anything. It only returns a candidate document; the
// caller sanitizes it (pages.ts's sanitizeData) and the staff member reviews
// a before/after preview before anything is saved or published.

import { sanitizeData, ALLOWED_BLOCKS, type PageData } from "./pages";
import { callAnthropicTool } from "./anthropic";

export type PageBrainContext = { path?: string; page?: string };

export type PageProposal = {
	/** conversational reply shown in the chat */
	reply: string;
	/** the proposed full document, already sanitized — null if no change was made */
	data: PageData | null;
	/** true when the request needs new design/code the AI can't produce here */
	needsDesign: boolean;
};

const BLOCK_GUIDE = `
Available blocks (the "type" of each content item) and their props:
- Hero: { kicker, heading, lede } — the page's big heading section. Usually first, and only one.
- Prose: { eyebrow, title, body, tinted } — a text section; body uses blank lines between paragraphs; tinted is boolean.
- Cards: { eyebrow, title, cards: [{ title, text }] } — a row of numbered cards.
- Quote: { text } — one pulled-out line.
- Buttons: { buttons: [{ label, href, style }] } — style is "primary" or "secondary"; href is a path like "/visit".
- Spacer: { size } — "24px" | "64px" | "120px".
- Image: { src, alt, caption, width } — src MUST be one of the site image paths listed below (never invent one); width is "full" or "inset".
- Video: { url, caption } — url is a YouTube link.
- FAQ: { eyebrow, title, items: [{ q, a }] } — accordion of questions.
- Callout: { eyebrow, title, body, buttons: [{ label, href, style }] } — a highlighted panel with optional buttons.
- Profiles: { items: [{ photo, name, role, bio, name2, role2, bio2 }] } — people cards; photo from the site image list; name2/role2/bio2 for a second person sharing the photo, else "".
- ListCards: { cards: [{ title, blurb, items }] } — cards with a bullet list; items is ONE STRING with one entry per line.
- Feature: { eyebrow, heading, subline, body, image, video, buttons, facts: [{ label, value }] } — media beside text with quick facts.
- CtaCards: { cards: [{ label, title, body, buttonLabel, buttonHref, featured }] } — action cards (featured is boolean).
Only these types: ${ALLOWED_BLOCKS.join(", ")}.
You may reorder existing blocks, and add or remove blocks of these EXISTING types. You may NOT invent a new block type.`;

function buildPrompt(message: string, current: PageData, images: string[], context: PageBrainContext): string {
	return [
		"You are the page-building assistant for the New Life Grand Rapids community website.",
		"You edit ONE page document (JSON). You have no file access — you only return an updated document.",
		BLOCK_GUIDE,
		"",
		"Site images available for Image blocks (use these exact paths only):",
		images.join("\n"),
		"",
		"Document shape: { root: { props: { title, kicker } }, content: [ { type, props } ] }.",
		"Keep existing content unless the request says otherwise; make the smallest change that fulfills it.",
		"Keep every unchanged block's props exactly as given, INCLUDING its \"id\" prop, so the change can be shown as a before/after diff.",
		"Write in the church's warm, reverent voice. British-headline minimalism; no exclamation-mark salesiness.",
		"",
		`The staff member is viewing: ${context.page || context.path || "this page"}.`,
		"",
		"Current page document:",
		JSON.stringify(current),
		"",
		`Request: "${message}"`,
		"",
		"If the request genuinely needs a new block type, custom design, or code you don't have — say so plainly in `reply`, set needsDesign true, and leave `data` out.",
		"Otherwise return JSON: { reply: one warm sentence about what you did, data: the FULL updated document, needsDesign: false }.",
	].join("\n");
}

const INPUT_SCHEMA = {
	type: "object",
	properties: {
		reply: { type: "string" },
		data: { type: "object" },
		needsDesign: { type: "boolean" },
	},
	required: ["reply"],
};

async function viaApi(prompt: string): Promise<{ reply: string; data?: any; needsDesign?: boolean }> {
	const out = await callAnthropicTool({
		prompt,
		toolName: "return_page",
		toolDescription: "Return the updated page document (or say the request needs design/code) and a one-sentence reply.",
		inputSchema: INPUT_SCHEMA,
		maxTokens: 8192,
	});
	return out as { reply: string; data?: any; needsDesign?: boolean };
}

const CLI_SCHEMA = JSON.stringify(INPUT_SCHEMA);

// Local brain: the claude CLI on the signed-in machine (your subscription).
async function viaCli(prompt: string): Promise<{ reply: string; data?: any; needsDesign?: boolean }> {
	const { execFile } = await import("node:child_process");
	const stdout = await new Promise<string>((resolve, reject) => {
		execFile(
			"claude",
			["-p", prompt, "--output-format", "json", "--json-schema", CLI_SCHEMA, "--allowedTools", "", "--strict-mcp-config", "--no-session-persistence", "--model", process.env.STUDIO_MODEL || "sonnet"],
			{ timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
			(err, out) => (err ? reject(err) : resolve(out.toString())),
		);
	});
	return JSON.parse(stdout)?.structured_output;
}

export async function proposePageEdit(
	message: string,
	current: PageData,
	images: string[],
	context: PageBrainContext = {},
): Promise<PageProposal> {
	const prompt = buildPrompt(message, current, images, context);
	const out = process.env.ANTHROPIC_API_KEY ? await viaApi(prompt) : await viaCli(prompt);
	if (!out || typeof out.reply !== "string") throw new Error("no structured output");
	if (out.needsDesign || !out.data) {
		return { reply: out.reply, data: null, needsDesign: Boolean(out.needsDesign) };
	}
	return { reply: out.reply, data: sanitizeData(out.data), needsDesign: false };
}
