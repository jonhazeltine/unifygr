// Chat: POST { message } → the brain proposes edits (not yet applied).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { readContent } from "../../../lib/studio/store";
import { proposeEdits } from "../../../lib/studio/brain";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

	const { message } = await request.json().catch(() => ({}));
	if (!message || typeof message !== "string") return json({ error: "No message." }, 400);

	const content = await readContent();
	const proposal = await proposeEdits(message, content);
	return json(proposal);
};
