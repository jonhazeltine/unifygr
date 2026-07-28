// The hand-built pages of the site, so the Page Builder can list EVERY page
// in one place. These are real .astro files — crafted code, not blocks — so
// the builder shows them as "hand-built": viewable, words editable via the
// chat dock, but not draggable apart like builder pages.
//
// Discovered from the source tree at build time (works in production too);
// titles come from a friendly map, with a prettified fallback.

// Keys look like "../../pages/visit.astro".
const PAGE_FILES = Object.keys(import.meta.glob("../../pages/*.astro"));

// Routes that aren't public content pages — plus pages that have been
// "blockified" (mounted builder pages), which list as builder pages instead.
const EXCLUDE = new Set([
	"index", // listed explicitly as Homepage first
	"studio", // the editor door
	"enter", // cinematic intro experience
	"[pillar]", // expanded below
	"land-sale-update-b7f2", // password-gated private page
	"happy-church", // local experiment, not a nav page
	"mission-trips", "membership", "spiritual-formation", "staff", "giving", // blockified
]);

const TITLES: Record<string, string> = {
	"visit": "Plan a Visit",
	"beliefs": "What We Believe",
	"vision-values": "Vision & Values",
	"unify-gr": "Unify GR",
	"watch": "Watch & Sermons",
};

function prettify(slug: string): string {
	return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export type SitePage = { path: string; title: string };

export function listHandBuiltPages(): SitePage[] {
	const out: SitePage[] = [{ path: "/", title: "Homepage" }];

	// The three pillar pages come from the dynamic [pillar] route.
	out.push(
		{ path: "/encounter-god", title: "Encounter God" },
		{ path: "/be-transformed", title: "Be Transformed" },
		{ path: "/change-the-world", title: "Change the World" },
	);

	const slugs = PAGE_FILES
		.map((f) => f.split("/").pop()!.replace(/\.astro$/, ""))
		.filter((s) => !EXCLUDE.has(s))
		.sort();
	for (const slug of slugs) {
		out.push({ path: `/${slug}`, title: TITLES[slug] || prettify(slug) });
	}
	return out;
}
