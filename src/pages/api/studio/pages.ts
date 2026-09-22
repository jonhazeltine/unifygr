// Builder pages API. Staff-only; all writes pass the sanitize fence.
//   GET                    → list pages (slug, title, status, order)
//   GET ?slug=             → one page's DRAFT (the editor's working copy —
//                            see readDraftPageState; never the public page)
//   POST {slug, data}      → save the draft (never touches the live page)
//   POST {slug, publish}   → push the draft live (content + status:"live")
//   POST {slug, status}    → flip draft/live with NO content change
//                            (unpublish — the one visibility-only toggle left)
//   POST {slug, order}     → set position
//   POST {slug, delete}    → remove the page
// In production writes commit to GitHub (result includes via:"git" so the UI
// can say "going live in a minute or two").
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { listPages, readDraftPageState, writeDraftPage, publishDraft, updatePageMeta, deletePage } from "../../../lib/studio/pages";
import { listHandBuiltPages } from "../../../lib/studio/site-pages";
import { ContentConflict } from "../../../lib/studio/runtime-content";
import { readSitePageStatuses, sitePageStatus, updateSitePageStatus } from "../../../lib/studio/site-page-state";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ url, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const slug = url.searchParams.get("slug");
	if (slug) {
		const page = await readDraftPageState(slug, locals);
		return page ? json(page) : json({ error: "Not found" }, 404);
	}
	const siteState = await readSitePageStatuses(locals);
	return json({
		pages: await listPages(locals),
		sitePages: listHandBuiltPages().map((page) => ({ ...page, status: sitePageStatus(page.path, siteState.value) })),
		sitePagesVersion: siteState.version,
	});
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const body = await request.json().catch(() => ({}));
	try {
		if (body?.sitePath) {
			const result = await updateSitePageStatus(body.sitePath, body.status, body.sitePagesVersion, locals);
			return json({ ok: true, ...result });
		}
		if (body?.create && (await listPages(locals)).some((page) => page.slug === body.slug)) {
			return json({ ok: false, error: "That page already exists. Open the latest copy before saving." }, 409);
		}
		if (body?.delete) {
			// Deleting is permanent, so this one genuinely needs a version to guard
			// against removing a copy newer than the one the staff member is looking at.
			if (typeof body?.version !== "string") return json({ ok: false, error: "This page changed. Refresh before deleting it." }, 409);
			const res = await deletePage(body.slug, body.version, locals);
			return json({ ok: true, via: res.via });
		}
		if (body?.data) {
			// Content saves genuinely need a version too, to guard against one save
			// silently clobbering a newer edit made elsewhere in the meantime. This
			// writes the DRAFT only — the live page is untouched until Publish.
			if (typeof body?.version !== "string" && !body?.create) return json({ ok: false, error: "This page changed. Refresh before saving your edits." }, 409);
			const res = await writeDraftPage(body.slug, body.data, body?.version, locals);
			return json({ ok: true, data: res.data, via: res.via, version: res.version, dirty: res.dirty });
		}
		if (body?.publish) {
			// Copies the current draft's content into the published record and
			// puts the page live — the one action that actually changes what
			// visitors see.
			const res = await publishDraft(body.slug, body?.version, locals);
			return json({ ok: true, data: res.data, via: res.via, version: res.version });
		}
		if (body?.status || body?.order != null) {
			// A draft/live flip or a reorder is not a content edit — nothing here can
			// silently overwrite someone else's newer prose. The client never actually
			// sends a version for this (it doesn't track one after the initial page
			// list load), so requiring one made every flip fail outright, every time.
			// updatePageMeta below still reads the current record fresh and writes with
			// a real conditional (CAS) request, so a genuine conflict is still caught —
			// this only drops the redundant, and here always-failing, pre-check.
			const res = await updatePageMeta(body.slug, { status: body.status, order: body.order }, body?.version, locals);
			return json({ ok: true, data: res.data, via: res.via, version: res.version });
		}
		return json({ ok: false, error: "Nothing to do." }, 400);
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, err instanceof ContentConflict ? 409 : 400);
	}
};
