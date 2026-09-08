/**
 * Redirects for the Clover URLs that were published under newlifegr.com.
 *
 * The Astro adapter should call redirectForRequest() from middleware. This
 * module deliberately has no Astro or adapter dependency so the mapping can be
 * reviewed and tested before the final hostname is activated.
 */

export const LEGACY_HOSTS = new Set(["unifygr.com", "www.unifygr.com"]);
export const FINAL_HOST = "newlifegr.com";
export const DEFAULT_SITE_URL = "https://unifygr.com";

/**
 * Old public paths mapped to their current equivalents.
 *
 * The Meals of Hope page remains staff-only, so its old event URL lands on the
 * live Outreach Teams page that describes the event's public ministry context.
 */
export const LEGACY_PATH_REDIRECTS = Object.freeze({
	"/": "/",
	"/about-us/our-staff": "/staff",
	"/about-us/vision-values": "/vision-values",
	"/about-us/what-we-believe": "/beliefs",
	"/get-involved": "/ministries",
	"/get-involved/church-ambassador-teams": "/ambassador-teams",
	"/get-involved/meals-of-hope-2026": "/outreach-teams",
	"/get-involved/membership": "/membership",
	"/get-involved/mission-trips": "/mission-trips",
	"/get-involved/spiritual-formation": "/spiritual-formation",
	"/giving": "/giving",
	"/giving/impact-fund": "/giving",
	"/home": "/",
	"/home/member-login": "https://newlife.ccbchurch.com",
	"/home/when-where": "/sunday#when-where",
	"/watch": "/watch",
});

function configuredSiteUrl(siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL) {
	return new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
}

/** Whether the final hostname has been explicitly activated through SITE_URL. */
export function finalDomainActive(siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL) {
	return configuredSiteUrl(siteUrl).hostname === FINAL_HOST;
}

/** Return the mapped path, preserving the incoming query string. */
export function redirectForPath(pathname, search = "") {
	const target = LEGACY_PATH_REDIRECTS[pathname];
	if (!target) return null;
	const targetUrl = new URL(target, "https://redirect.invalid");
	if (search) targetUrl.search = search;
	return /^https?:\/\//.test(target)
		? targetUrl.toString()
		: `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

/**
 * Return an absolute redirect target for an old-host request, or null.
 * Host redirects stay disabled until SITE_URL is set to https://newlifegr.com.
 */
export function redirectForRequest(request, siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL) {
	if (!finalDomainActive(siteUrl)) return null;
	const incoming = new URL(request.url);
	if (!LEGACY_HOSTS.has(incoming.hostname)) return null;
	const mapped = redirectForPath(incoming.pathname, incoming.search);
	const destination = configuredSiteUrl(siteUrl);
	if (mapped && /^https?:\/\//.test(LEGACY_PATH_REDIRECTS[incoming.pathname])) return mapped;
	destination.pathname = mapped ? mapped.split("?")[0] : incoming.pathname;
	destination.search = mapped?.includes("?") ? `?${mapped.split("?").slice(1).join("?")}` : incoming.search;
	// URL fragments are not sent in HTTP requests; mapped fragments are safe to
	// append to the Location response for browser navigation.
	if (mapped?.includes("#")) {
		const [pathAndQuery, hash] = mapped.split("#", 2);
		destination.pathname = pathAndQuery.split("?")[0];
		destination.search = pathAndQuery.includes("?")
			? `?${pathAndQuery.split("?").slice(1).join("?")}`
			: incoming.search;
		destination.hash = hash;
	}
	return destination.toString();
}
