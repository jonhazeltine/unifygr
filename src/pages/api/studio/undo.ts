// Undo: POST → restore the most recent snapshot (walks back one step each call).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { undo, historyCount } from "../../../lib/studio/store";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

	const result = await undo();
	if (!result) return json({ ok: false, error: "Nothing to undo." }, 400);
	return json({ ok: true, restoredFrom: result.restoredFrom, canUndo: (await historyCount()) > 0 });
};
