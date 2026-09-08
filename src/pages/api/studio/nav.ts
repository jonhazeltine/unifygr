// Navigation API: GET → the menu document; POST {nav} → save it.
// Staff-only; writes pass the sanitize fence (labels + links only).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { readNavState, writeNav } from "../../../lib/studio/nav";
import { ContentConflict } from "../../../lib/studio/runtime-content";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	return json(await readNavState(locals));
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const body = await request.json().catch(() => ({}));
	try {
		if (typeof body?.version !== "string") return json({ ok: false, error: "Refresh the menu before saving." }, 409);
		const res = await writeNav(body?.nav, body.version, locals);
		return json({ ok: true, nav: res.nav, via: res.via, version: res.version });
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, err instanceof ContentConflict ? 409 : 400);
	}
};
