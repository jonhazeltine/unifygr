// Publish: POST { edits, summary } → apply to content (fence re-checked in the
// store) and snapshot the prior state for undo.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { applyEdits, historyCount, type Edit } from "../../../lib/studio/store";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

	const body = await request.json().catch(() => ({}));
	const edits: Edit[] = Array.isArray(body?.edits) ? body.edits : [];
	if (edits.length === 0) return json({ error: "No edits to publish." }, 400);

	try {
		const { version } = await applyEdits(edits, body?.summary || "Edit via studio");
		return json({ ok: true, version, canUndo: (await historyCount()) > 0 });
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, 400);
	}
};
