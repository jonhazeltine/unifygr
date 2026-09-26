// Publish a Page Builder page proposed by the Studio dock's AI chat.
// POST { slug, data, version } → writes the draft through the existing
// versioned save path (writeDraftPage), then immediately pushes it live
// (publishDraft) — the dock shows a before/after preview first, so by the
// time this is called staff have already reviewed the change and pressed
// Publish. Revisions and the page's normal draft/publish history are
// untouched: this is the same save path the visual builder uses.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { publishDraft, sanitizeData, writeDraftPage } from "../../../lib/studio/pages";
import { ContentConflict } from "../../../lib/studio/runtime-content";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ ok: false, error: "Unauthorized" }, 401);

	const body = await request.json().catch(() => ({}));
	const { slug, data } = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
	if (typeof slug !== "string" || !data || typeof data !== "object") {
		return json({ ok: false, error: "Nothing to publish." }, 400);
	}
	if (typeof body?.version !== "string") {
		return json({ ok: false, error: "This page changed. Refresh and review it before publishing." }, 409);
	}

	try {
		await writeDraftPage(slug, sanitizeData(data), body.version as string, locals);
		const published = await publishDraft(slug, undefined, locals);
		return json({ ok: true, data: published.data, version: published.version });
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, err instanceof ContentConflict ? 409 : 400);
	}
};
