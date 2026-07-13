// Passcode gate: POST { passcode } to sign in, DELETE to sign out.
export const prerender = false;

import type { APIRoute } from "astro";
import { checkPasscode, grant, revoke, isAuthed } from "../../../lib/studio/auth";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = ({ cookies }) => json({ authed: isAuthed(cookies) });

export const POST: APIRoute = async ({ request, cookies }) => {
	const { passcode } = await request.json().catch(() => ({}));
	if (!checkPasscode(passcode)) return json({ ok: false, error: "Wrong passcode." }, 401);
	grant(cookies);
	return json({ ok: true });
};

export const DELETE: APIRoute = ({ cookies }) => {
	revoke(cookies);
	return json({ ok: true });
};
