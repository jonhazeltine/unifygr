// The AI co-editor for the visual builder. POST { message, data } → Claude
// (local CLI, your subscription) rewrites the page DOCUMENT — pure JSON in,
// JSON out, no file access — and the result goes back to the editor for
// review. sanitizeData() fences whatever comes back to known block types.
export const prerender = false;

import type { APIRoute } from "astro";
import { execFile } from "node:child_process";
import { isAuthed } from "../../../lib/studio/auth";
import { sanitizeData, ALLOWED_BLOCKS } from "../../../lib/studio/pages";
import { listSiteImages } from "../../../lib/studio/media";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const SCHEMA = JSON.stringify({
	type: "object",
	properties: { reply: { type: "string" }, data: { type: "object" } },
	required: ["reply", "data"],
});

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
Only these types: ${ALLOWED_BLOCKS.join(", ")}.`;

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

	const { message, data } = await request.json().catch(() => ({}));
	if (!message || typeof message !== "string") return json({ error: "No message." }, 400);

	const current = sanitizeData(data);
	const images = (await listSiteImages()).slice(0, 80);
	const prompt = [
		"You are the page-building assistant for the New Life Grand Rapids church website.",
		"You edit ONE page document (JSON). You have no file access — you only return an updated document.",
		BLOCK_GUIDE,
		"",
		"Site images available for Image blocks (use these exact paths only):",
		images.join("\n"),
		"",
		"Document shape: { root: { props: { title, kicker } }, content: [ { type, props } ] }.",
		"Keep existing content unless the request says otherwise; make the smallest change that fulfills it.",
		"Write in the church's warm, reverent voice. British-headline minimalism; no exclamation-mark salesiness.",
		"",
		"Current page document:",
		JSON.stringify(current),
		"",
		`Request: "${message}"`,
		"",
		"Return JSON: { reply: one warm sentence about what you did, data: the FULL updated document }.",
	].join("\n");

	try {
		const stdout = await new Promise<string>((resolve, reject) => {
			execFile(
				"claude",
				["-p", prompt, "--output-format", "json", "--json-schema", SCHEMA, "--allowedTools", "", "--strict-mcp-config", "--no-session-persistence", "--model", process.env.STUDIO_MODEL || "sonnet"],
				{ timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
				(err, out) => (err ? reject(err) : resolve(out.toString())),
			);
		});
		const out = JSON.parse(stdout)?.structured_output;
		if (!out?.data) throw new Error("no structured output");
		return json({ reply: String(out.reply || "Done — review the change."), data: sanitizeData(out.data) });
	} catch (err) {
		return json({ reply: "I couldn't reach the AI on this machine — drag-and-drop still works.", error: (err as Error).message.slice(0, 200) }, 502);
	}
};
