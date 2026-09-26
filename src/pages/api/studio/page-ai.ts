// The AI co-editor for the visual builder. POST { message, data } → Claude
// (local CLI, your subscription, or the metered API) rewrites the page
// DOCUMENT — pure JSON in, JSON out, no file access — and the result goes
// back to the editor for review. sanitizeData() fences whatever comes back to
// known block types. Shares its brain (src/lib/studio/page-brain.ts) with the
// on-page Studio dock chat, so both surfaces behave identically.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { isCloudflareWorker } from "../../../lib/runtime";
import { sanitizeData } from "../../../lib/studio/pages";
import { listSiteImages } from "../../../lib/studio/media";
import { proposePageEdit } from "../../../lib/studio/page-brain";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

	const body = await request.json().catch(() => null);
	const { message, data, title } = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
	if (!message || typeof message !== "string") return json({ error: "No message." }, 400);

	const current = sanitizeData(data);
	const images = (await listSiteImages(locals)).slice(0, 80);

	try {
		if (!process.env.ANTHROPIC_API_KEY && isCloudflareWorker()) {
			return json({ reply: "The AI editor isn't connected on this deployment.", error: "AI unavailable" }, 503);
		}
		const proposal = await proposePageEdit(message, current, images, { page: typeof title === "string" ? title : undefined });
		if (proposal.needsDesign || !proposal.data) {
			return json({ reply: proposal.reply, needsDesign: true });
		}
		return json({ reply: proposal.reply, data: proposal.data });
	} catch (err) {
		return json({ reply: "I couldn't reach the AI right now — drag-and-drop still works.", error: (err as Error).message.slice(0, 200) }, 502);
	}
};
