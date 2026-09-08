// Undo the agent's last change (restores files to their pre-change baseline).
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { isCloudflareWorker } from "../../../lib/runtime";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ cookies }) => {
  if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
  if (isCloudflareWorker()) {
    return json(
      { error: "File-history undo is available only in the local Studio." },
      503,
    );
  }
  const { undoAgent, agentHistoryCount } =
    await import("../../../lib/studio/agent");
  const result = await undoAgent();
  return json({ ...result, canUndo: (await agentHistoryCount()) > 0 });
};
