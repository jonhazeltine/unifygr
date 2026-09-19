import { defineMiddleware } from "astro:middleware";
import { redirectForRequest } from "../domain-redirects.mjs";
import { isAuthed } from "./lib/studio/auth";
import { sitePageDraftGuard } from "./lib/studio/site-page-state";

export const onRequest = defineMiddleware(async ({ request, redirect, cookies, locals }, next) => {
	const target = redirectForRequest(request, process.env.PUBLIC_SITE_URL);
	if (target) return redirect(target, 308);
	const { pathname } = new URL(request.url);
	if (!pathname.startsWith("/studio") && !pathname.startsWith("/api/") && !pathname.includes(".")) {
		const blocked = await sitePageDraftGuard(pathname, isAuthed(cookies), locals);
		if (blocked) return blocked;
	}
	return next();
});
