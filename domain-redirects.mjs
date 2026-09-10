/**
 * Redirects for the Clover URLs that were published under newlifegr.com.
 *
 * The Astro adapter should call redirectForRequest() from middleware. This
 * module deliberately has no Astro or adapter dependency so the mapping can be
 * reviewed and tested before the final hostname is activated.
 */

export const LEGACY_HOSTS = new Set(["unifygr.com", "www.unifygr.com"]);
export const FINAL_HOST = "newlifegr.com";
export const DEFAULT_SITE_URL = "https://newlifegr.com";

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

function configuredSiteUrl(siteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL) {
	return new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
}

/** Whether the final hostname has been explicitly activated through PUBLIC_SITE_URL. */
export function finalDomainActive(siteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL) {
	return configuredSiteUrl(siteUrl).hostname === FINAL_HOST;
}

/** Return the mapped path, preserving the incoming query string and fragment. */
export function redirectForPath(pathname, search = "", hash = "") {
	const target = LEGACY_PATH_REDIRECTS[pathname];
	if (!target) return null;
	const targetUrl = new URL(target, "https://redirect.invalid");
	if (search) targetUrl.search = search;
	if (hash) targetUrl.hash = hash;
	return /^https?:\/\//.test(target)
		? targetUrl.toString()
		: `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

/**
 * Return an absolute redirect target for an old-path/host request, or null.
 * Host canonicalisation stays disabled until PUBLIC_SITE_URL is set to
 * https://newlifegr.com. Old paths may still map on the current host before
 * that final activation.
 */
export function redirectForRequest(request, siteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL) {
	const incoming = new URL(request.url);
	// Webhooks and API clients keep using the old host during the domain
	// transition. Serve them directly so POST bodies and signatures survive.
	if (incoming.pathname === "/api" || incoming.pathname.startsWith("/api/")) return null;
	const finalActive = finalDomainActive(siteUrl);
	const oldHost = LEGACY_HOSTS.has(incoming.hostname);
	const finalWww = incoming.hostname === `www.${FINAL_HOST}`;
	const mapped = redirectForPath(incoming.pathname, incoming.search, incoming.hash);
	const targetPath = LEGACY_PATH_REDIRECTS[incoming.pathname];
	const targetIsExternal = typeof targetPath === "string" && /^https?:\/\//.test(targetPath);

	const canonicalizeHost = finalActive && (oldHost || finalWww);
	if (!mapped && !canonicalizeHost) return null;
	if (mapped && targetIsExternal) return mapped;

	// Path-only redirects retain the request origin, including a local preview
	// port. Only explicitly activated production hosts change origin.
	const destination = mapped ? new URL(mapped, incoming.origin) : new URL(incoming);
	if (canonicalizeHost) {
		destination.protocol = "https:";
		destination.hostname = FINAL_HOST;
		destination.port = "";
	}
	return destination.toString() === incoming.toString() ? null : destination.toString();
}
