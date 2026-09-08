import type { APIRoute } from "astro";
import { imageMime, publishedUpload } from "../../lib/studio/media";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const file = params.file || "";
	const contentType = imageMime(file);
	if (!contentType) return new Response("Not found", { status: 404 });
	const upload = await publishedUpload(file, locals);
	if (!upload) return new Response("Not found", { status: 404 });
	return new Response(upload.stream, {
		headers: {
		"content-type": contentType,
		"cache-control": "public, max-age=31536000, immutable",
		"x-content-type-options": "nosniff",
		},
	});
};
