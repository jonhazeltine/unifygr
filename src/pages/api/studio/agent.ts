// Free-form CMS agent: POST { message, path, page } → Claude Code edits the
// real site files (protected paths fenced, build-gated, snapshotted for undo).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { runAgent, agentHistoryCount } from "../../../lib/studio/agent";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

	const { message, path, page } = await request.json().catch(() => ({}));
	if (!message || typeof message !== "string") return json({ error: "No message." }, 400);

	const result = await runAgent(message, { path, page });
	return json({ ...result, canUndo: (await agentHistoryCount()) > 0 });
};
