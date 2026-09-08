// Publish: POST { edits, summary } → apply to content (fence re-checked in the
// store) and snapshot the prior state for undo.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { applyEdits, historyCount, type Edit } from "../../../lib/studio/store";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

	const body = await request.json().catch(() => ({}));
	const edits: Edit[] = Array.isArray(body?.edits) ? body.edits : [];
	if (edits.length === 0) return json({ error: "No edits to publish." }, 400);
	if (typeof body?.version !== "string") return json({ error: "This content changed. Refresh and review it before publishing." }, 409);

	try {
		const { version } = await applyEdits(edits, body?.summary || "Edit via studio", body?.version, locals);
		return json({ ok: true, version, canUndo: (await historyCount(locals)) > 0 });
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, 400);
	}
};
