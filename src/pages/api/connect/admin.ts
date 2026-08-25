// Reads submissions for the admin page, and retries a failed delivery.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/connect/auth";
import { deliverToAsana, deliverToCcb } from "../../../lib/connect/deliver";
import { readOne, recent, save } from "../../../lib/connect/store";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ cookies }) => {
	if (!isAuthed(cookies)) return json({ ok: false, error: "Not signed in." }, 401);
	try {
		return json({ ok: true, submissions: await recent(100) });
	} catch (err) {
		return json({ ok: false, error: err instanceof Error ? err.message : "Could not read submissions." }, 500);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ ok: false, error: "Not signed in." }, 401);

	const { id, target } = (await request.json().catch(() => ({}))) as { id?: string; target?: string };
	if (!id) return json({ ok: false, error: "Which submission?" }, 400);

	const submission = await readOne(id);
	if (!submission) return json({ ok: false, error: "That submission is no longer on file." }, 404);

	if (target === "ccb" || target === "both") submission.ccb = await deliverToCcb(submission);
	if (target === "asana" || target === "both" || !target) submission.asana = await deliverToAsana(submission);

	await save(submission);
	return json({ ok: true, submission });
};
