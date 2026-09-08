// Chat: POST { message } → the brain proposes edits (not yet applied).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { readContentSnapshot } from "../../../lib/studio/store";
import { proposeEdits } from "../../../lib/studio/brain";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => null);
  const { message, path, page } =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (!message || typeof message !== "string")
    return json({ error: "No message." }, 400);

	const snapshot = await readContentSnapshot(locals);
	const proposal = await proposeEdits(message, snapshot.content, {
    path: typeof path === "string" ? path : undefined,
    page: typeof page === "string" ? page : undefined,
  });
	return json({ ...proposal, version: snapshot.version });
};
