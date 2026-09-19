import { defineMiddleware } from "astro:middleware";
import { redirectForRequest } from "../domain-redirects.mjs";
import { isAuthed } from "./lib/studio/auth";
import { sitePageDraftGuard } from "./lib/studio/site-page-state";
import { isPagePublished, withPageVisibilityHeaders } from "./lib/studio/page-visibility";

export const onRequest = defineMiddleware(async ({ request, redirect, cookies, locals }, next) => {
	const target = redirectForRequest(request, process.env.PUBLIC_SITE_URL);
	if (target) return redirect(target, 308);
	const { pathname } = new URL(request.url);
	if (!pathname.startsWith("/studio") && !pathname.startsWith("/api/") && !pathname.includes(".")) {
		const staff = isAuthed(cookies);
		const blocked = await sitePageDraftGuard(pathname, staff, locals);
		if (blocked) return blocked;
		const response = await next();
		// Every public page can now be unpublished from Studio. Never place these
		// responses in a shared cache, or a previously published page could remain
		// visible after its switch is changed to Draft.
		const draftPreview = staff && !(await isPagePublished(pathname, locals));
		return withPageVisibilityHeaders(response, draftPreview);
	}
	return next();
});
