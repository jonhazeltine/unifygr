// Free-form CMS agent: POST { message, path, page } → Claude Code edits the
// real site files (protected paths fenced, build-gated, snapshotted for undo).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { isCloudflareWorker } from "../../../lib/runtime";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => null);
  const { message, path, page } =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (!message || typeof message !== "string")
    return json({ error: "No message." }, 400);
  if (isCloudflareWorker()) {
    return json(
      {
        error: "This file-editing tool is available only in the local Studio.",
      },
      503,
    );
  }

  const { runAgent, agentHistoryCount } =
    await import("../../../lib/studio/agent");
  const result = await runAgent(message, {
    path: typeof path === "string" ? path : undefined,
    page: typeof page === "string" ? page : undefined,
  });
  return json({ ...result, canUndo: (await agentHistoryCount()) > 0 });
};
