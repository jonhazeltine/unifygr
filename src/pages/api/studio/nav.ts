// Navigation API: GET → the menu document; POST {nav} → save it.
// Staff-only; writes pass the sanitize fence (labels + links only).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { readNav, writeNav } from "../../../lib/studio/nav";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	return json({ nav: await readNav() });
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const body = await request.json().catch(() => ({}));
	try {
		const res = await writeNav(body?.nav);
		return json({ ok: true, nav: res.nav, via: res.via });
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, 400);
	}
};
