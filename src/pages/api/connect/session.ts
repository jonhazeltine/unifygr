// Sign in / out of the Connect Card admin page.
export const prerender = false;

import type { APIRoute } from "astro";
import { checkPasscode, grant, revoke, isAuthed } from "../../../lib/connect/auth";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = ({ cookies }) => json({ authed: isAuthed(cookies) });

export const POST: APIRoute = async ({ request, cookies }) => {
	const body: unknown = await request.json().catch(() => null);
	const passcode = body && typeof body === "object" ? (body as Record<string, unknown>).passcode : undefined;
	if (!checkPasscode(passcode)) return json({ ok: false, error: "Wrong password." }, 401);
	grant(cookies);
	return json({ ok: true });
};

export const DELETE: APIRoute = ({ cookies }) => {
	revoke(cookies);
	return json({ ok: true });
};
