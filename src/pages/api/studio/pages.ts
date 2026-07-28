// Builder pages API. Staff-only; all writes pass the sanitize fence.
//   GET                    → list pages (slug, title, status, order)
//   GET ?slug=             → one page document
//   POST {slug, data}      → save content (keeps current status/order)
//   POST {slug, status}    → flip draft/live
//   POST {slug, order}     → set position
//   POST {slug, delete}    → remove the page
// In production writes commit to GitHub (result includes via:"git" so the UI
// can say "going live in a minute or two").
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { listPages, readPage, writePage, updatePageMeta, deletePage } from "../../../lib/studio/pages";
import { listHandBuiltPages } from "../../../lib/studio/site-pages";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ url, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const slug = url.searchParams.get("slug");
	if (slug) {
		const data = await readPage(slug);
		return data ? json({ data }) : json({ error: "Not found" }, 404);
	}
	return json({ pages: await listPages(), sitePages: listHandBuiltPages() });
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const body = await request.json().catch(() => ({}));
	try {
		if (body?.delete) {
			const res = await deletePage(body.slug);
			return json({ ok: true, via: res.via });
		}
		if (body?.data) {
			const res = await writePage(body.slug, body.data);
			return json({ ok: true, data: res.data, via: res.via });
		}
		if (body?.status || body?.order != null) {
			const res = await updatePageMeta(body.slug, { status: body.status, order: body.order });
			return json({ ok: true, data: res.data, via: res.via });
		}
		return json({ ok: false, error: "Nothing to do." }, 400);
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, 400);
	}
};
