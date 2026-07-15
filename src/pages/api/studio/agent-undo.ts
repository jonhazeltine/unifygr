// Undo the agent's last change (restores files to their pre-change baseline).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { undoAgent, agentHistoryCount } from "../../../lib/studio/agent";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const result = await undoAgent();
	return json({ ...result, canUndo: (await agentHistoryCount()) > 0 });
};
