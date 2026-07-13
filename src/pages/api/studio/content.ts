// Returns the current editable content: the fenced fields with their live
// values, grouped for display. Staff-only.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { readContent } from "../../../lib/studio/store";
import { editableFields } from "../../../lib/studio/schema";
import { historyCount } from "../../../lib/studio/store";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function getPath(obj: any, dotPath: string): unknown {
	return dotPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export const GET: APIRoute = async ({ cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

	const content = await readContent();
	const fields = editableFields(content).map((f) => ({
		path: f.path,
		label: f.label,
		group: f.group,
		hint: f.hint ?? null,
		value: getPath(content, f.path) ?? "",
	}));

	return json({ fields, canUndo: (await historyCount()) > 0 });
};
