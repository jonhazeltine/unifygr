// The ministry directory's listing switches.
import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { readOrgs, writeOrgs, type OrgChange } from "../../../lib/partners/directory";
import { ContentConflict } from "../../../lib/studio/runtime-content";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Sign in first." }, 401);
	try {
		return json(await readOrgs(locals));
	} catch (err: any) {
		return json({ error: `Couldn't read the directory: ${err?.message || "no reason given"}` }, 500);
	}
};

export const PUT: APIRoute = async ({ request, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Sign in first." }, 401);
	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: "That save didn't arrive in one piece. Try again." }, 400);
	}
	if (!body || typeof body.changes !== "object" || body.changes === null)
		return json({ error: "That save didn't arrive in one piece. Try again." }, 400);
	try {
		const saved = await writeOrgs(body.changes as Record<string, OrgChange>, body.version, locals);
		return json({ ...saved, ...(await readOrgs(locals)) });
	} catch (err: any) {
		return json({ error: `Couldn't save: ${err?.message || "no reason given"}` }, err instanceof ContentConflict ? 409 : 500);
	}
};
