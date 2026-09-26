// Chat: POST { message, path, page } → the brain proposes edits (not yet
// applied). When the current page is backed by a Page Builder document (any
// block-built page, including pages like /giving), the request is routed to
// the full-page brain instead of the fenced site.json fields, so staff can
// ask for any heading/text/button/link/block-prop change, reordering, or
// adding/removing existing block types — not just the ~10 site-wide fields.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { readContentSnapshot } from "../../../lib/studio/store";
import { proposeEdits } from "../../../lib/studio/brain";
import { readDraftPageState, resolvePageSlugFromPath } from "../../../lib/studio/pages";
import { listSiteImages } from "../../../lib/studio/media";
import { proposePageEdit } from "../../../lib/studio/page-brain";
import { diffPageBlocks } from "../../../lib/studio/page-diff";

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

  const pageContext = {
    path: typeof path === "string" ? path : undefined,
    page: typeof page === "string" ? page : undefined,
  };

  const slug = typeof path === "string" ? resolvePageSlugFromPath(path) : null;
  if (slug) {
    const draft = await readDraftPageState(slug, locals);
    if (draft) {
      try {
        const images = (await listSiteImages(locals)).slice(0, 80);
        const proposal = await proposePageEdit(message, draft.data, images, pageContext);
        if (proposal.needsDesign || !proposal.data) {
          return json({ reply: proposal.reply, kind: "page", edits: [] });
        }
        const edits = diffPageBlocks(draft.data, proposal.data);
        if (!edits.length) {
          return json({ reply: proposal.reply || "That already matches — nothing to change.", kind: "page", edits: [] });
        }
        return json({ reply: proposal.reply, kind: "page", slug, data: proposal.data, version: draft.version, edits });
      } catch {
        return json({ error: "The editor couldn't prepare that change. Try again." }, 502);
      }
    }
  }

  const snapshot = await readContentSnapshot(locals);
  try {
    const proposal = await proposeEdits(message, snapshot.content, pageContext);
    return json({ ...proposal, version: snapshot.version });
  } catch {
    return json({ error: "The editor couldn't prepare that change. Try again." }, 502);
  }
};
