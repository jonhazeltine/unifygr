// One link for every "join Formation" button on the site. Point a CTA at
// FORMATION_SMART_LINK instead of theformation.app directly, and this decides
// where the visitor actually lands: the app stores on a phone, the website on
// a desktop. Before this existed, every device got the same desktop link, so
// a phone visitor was sent to a website instead of being offered the app.

// No import from ./formation here on purpose — that module imports
// FORMATION_SMART_LINK from this one for its own community-link fallback,
// and a two-way import would be circular.

/** The one URL every Formation CTA on the site should use. */
export const FORMATION_SMART_LINK = "/app";

export const IOS_APP_STORE_URL =
	"https://apps.apple.com/us/app/the-formation-journey/id6754638655";
export const ANDROID_PLAY_STORE_URL =
	"https://play.google.com/store/apps/details?id=app.lovable.b13f621119de478a8961aa260c5e2c2c";

/**
 * Desktop (and anything that isn't clearly a phone) lands on New Life's own
 * community. Kept as its own literal, matching src/lib/formation.ts's
 * COMMUNITY_URL, rather than importing it — see the note above.
 */
export const FORMATION_DESKTOP_URL = "https://theformation.app/join/0LY0R";

/**
 * Where a visitor should land, based on their browser's User-Agent.
 * iPhone/iPad/iPod -> the App Store; Android -> Play Store; everything
 * else (desktop, an unknown or missing header) -> the website.
 */
export function pickFormationDestination(userAgent: string | null | undefined): string {
	const ua = userAgent ?? "";
	if (/iPad|iPhone|iPod/i.test(ua)) return IOS_APP_STORE_URL;
	if (/Android/i.test(ua)) return ANDROID_PLAY_STORE_URL;
	return FORMATION_DESKTOP_URL;
}
