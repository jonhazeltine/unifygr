// Reading and saving the panel's choices.
import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { ContentConflict } from "../../../lib/studio/runtime-content";
import { normalise, readSettingsState, writeSettingsVersioned } from "../../../lib/partners/settings";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Sign in first." }, 401);
	return json(await readSettingsState(locals));
};

export const PUT: APIRoute = async ({ request, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Sign in first." }, 401);
	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: "That save didn't arrive in one piece. Try again." }, 400);
	}
	if (!body || !Array.isArray(body.partners) || typeof body.version !== "string")
		return json({ error: "That save didn't arrive in one piece. Try again." }, 400);
	try {
		return json(await writeSettingsVersioned(normalise(body), body.version, locals));
	} catch (err: any) {
		return json({ error: `Couldn't save: ${err?.message || "no reason given"}` }, err instanceof ContentConflict ? 409 : 500);
	}
};
