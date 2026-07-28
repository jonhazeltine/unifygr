// Media library for the builder. GET → list site images (existing art +
// staff uploads). POST {name, dataBase64} → save an upload to public/uploads/.
// Staff-only; logic lives in src/lib/studio/media.ts.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { listSiteImages, saveUpload } from "../../../lib/studio/media";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	return json({ images: await listSiteImages() });
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const { name, dataBase64 } = await request.json().catch(() => ({}));
	if (!name || !dataBase64) return json({ error: "Missing file." }, 400);
	try {
		const res = await saveUpload(name, dataBase64);
		return json({ ok: true, src: res.src, via: res.via });
	} catch (err) {
		return json({ error: (err as Error).message }, 400);
	}
};
