import type { APIRoute } from "astro";
import { publishedUpload } from "../../lib/studio/media";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const file = params.file || "";
	const upload = await publishedUpload(file, locals);
	if (!upload) return new Response("Not found", { status: 404 });
	return new Response(upload.stream, {
		headers: {
			"content-type": upload.blob.contentType || "application/octet-stream",
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
};
