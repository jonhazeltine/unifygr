import { defineMiddleware } from "astro:middleware";
import { redirectForRequest } from "../domain-redirects.mjs";

export const onRequest = defineMiddleware(async ({ request, redirect }, next) => {
	const target = redirectForRequest(request, process.env.PUBLIC_SITE_URL);
	return target ? redirect(target, 308) : next();
});
