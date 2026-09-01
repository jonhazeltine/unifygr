// The staff gate for the partners panel.
//
// Same passcode as the Studio: the people who edit the site are the people who
// decide which churches feed the calendar, so there is nothing to remember.
import type { APIRoute } from "astro";
import { checkPasscode, grant, isAuthed, revoke } from "../../../lib/studio/auth";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = ({ cookies }) => json({ authed: isAuthed(cookies) });

export const POST: APIRoute = async ({ request, cookies }) => {
	const { passcode } = await request.json().catch(() => ({}) as any);
	if (!checkPasscode(passcode)) return json({ error: "That password isn't right." }, 401);
	grant(cookies);
	return json({ authed: true });
};

export const DELETE: APIRoute = ({ cookies }) => {
	revoke(cookies);
	return json({ authed: false });
};
