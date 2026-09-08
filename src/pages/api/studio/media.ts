// Media library for the builder. GET → list site images (existing art +
// staff uploads). POST {name, dataBase64} → save an upload to public/uploads/.
// Staff-only; logic lives in src/lib/studio/media.ts.
export const prerender = false;

import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { listSiteImages, promoteUpload, saveUpload } from "../../../lib/studio/media";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	return json({ images: await listSiteImages(locals) });
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
	if (!isAuthed(cookies)) return json({ error: "Unauthorized" }, 401);
	const { name, dataBase64, promote } = await request.json().catch(() => ({}));
	try {
		if (promote) return json({ ok: true, ...(await promoteUpload(String(promote), locals)) });
		if (!name || !dataBase64) return json({ error: "Missing file." }, 400);
		return json({ ok: true, ...(await saveUpload(name, dataBase64, locals)) });
	} catch (err) {
		return json({ error: (err as Error).message }, 400);
	}
};
