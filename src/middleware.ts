import { defineMiddleware } from "astro:middleware";
import { redirectForRequest } from "../domain-redirects.mjs";
import { isAuthed } from "./lib/studio/auth";
import { isSitePageDraft, sitePageDraftGuard } from "./lib/studio/site-page-state";

export const onRequest = defineMiddleware(async ({ request, redirect, cookies, locals }, next) => {
	const target = redirectForRequest(request, process.env.PUBLIC_SITE_URL);
	if (target) return redirect(target, 308);
	const { pathname } = new URL(request.url);
	if (!pathname.startsWith("/studio") && !pathname.startsWith("/api/") && !pathname.includes(".")) {
		const staff = isAuthed(cookies);
		const blocked = await sitePageDraftGuard(pathname, staff, locals);
		if (blocked) return blocked;
		const response = await next();
		if (staff && await isSitePageDraft(pathname, locals)) {
			const headers = new Headers(response.headers);
			headers.set("cache-control", "private, no-store");
			headers.set("x-robots-tag", "noindex");
			return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
		}
		return response;
	}
	return next();
});
