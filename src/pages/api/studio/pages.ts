// Builder pages API: GET → list; GET ?slug= → one page; POST {slug, data} → save.
// All access staff-only; writes pass through the sanitize fence.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { listPages, readPage, writePage } from "../../../lib/studio/pages";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ url, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const slug = url.searchParams.get("slug");
	if (slug) {
		const data = await readPage(slug);
		return data ? json({ data }) : json({ error: "Not found" }, 404);
	}
	return json({ pages: await listPages() });
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const body = await request.json().catch(() => ({}));
	try {
		const clean = await writePage(body?.slug, body?.data);
		return json({ ok: true, data: clean });
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, 400);
	}
};
