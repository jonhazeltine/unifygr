// The hand-built pages of the site, so the Page Builder can list EVERY page
// in one place. These are real .astro files — crafted code, not blocks — so
// the builder shows them as "hand-built": viewable, words editable via the
// chat dock, but not draggable apart like builder pages.
//
// Discovered from the source tree at build time (works in production too);
// titles come from a friendly map, with a prettified fallback.

// Keys look like "../../pages/visit.astro". Vite only transforms direct
// import.meta.glob calls; plain Node reaches the catch in unit tests.
let PAGE_FILES: string[] = [];
try {
	PAGE_FILES = Object.keys(import.meta.glob("../../pages/**/*.astro"));
} catch {
	PAGE_FILES = [];
}

// Routes that aren't public content pages — plus pages that have been
// "blockified" (mounted builder pages), which list as builder pages instead.
const EXCLUDE = new Set([
	"index", // listed explicitly as Homepage first
	"studio", // the editor door
	"enter", // cinematic intro experience
	"[pillar]", // expanded below
	"land-sale-update-b7f2", // password-gated private page
	"happy-church", // local experiment, not a nav page
	"mission-trips", "staff", "giving", // blockified
]);

const TITLES: Record<string, string> = {
	"visit": "Plan a Visit",
	"spiritual-formation": "Spiritual Formation",
	"beliefs": "What We Believe",
	"vision-values": "Vision & Values",
	"watch": "Watch & Sermons",
};

function prettify(slug: string): string {
	return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export type SitePage = { path: string; title: string; previewImage: string };

export function previewPath(path: string): string {
	const file = path === "/" ? "home" : path.slice(1).replace(/\//g, "--");
	return `/art/studio-page-previews/${file}.webp`;
}

export function listHandBuiltPages(): SitePage[] {
	const out: SitePage[] = [{ path: "/", title: "Homepage", previewImage: previewPath("/") }];

	// The three pillar pages come from the dynamic [pillar] route.
	out.push(
		{ path: "/encounter-god", title: "Encounter God", previewImage: previewPath("/encounter-god") },
		{ path: "/be-transformed", title: "Be Transformed", previewImage: previewPath("/be-transformed") },
		{ path: "/change-the-world", title: "Change the World", previewImage: previewPath("/change-the-world") },
	);

	const slugs = PAGE_FILES
		.map((file) => file.split("/pages/").pop()!.replace(/\.astro$/, "").replace(/\/index$/, ""))
		.filter((slug) => !slug.includes("[") && !["admin", "studio", "p", "ministry"].includes(slug.split("/")[0]))
		.filter((slug) => !EXCLUDE.has(slug))
		.sort();
	for (const slug of slugs) {
		const path = `/${slug}`;
		out.push({ path, title: TITLES[slug] || prettify(slug.split("/").pop()!), previewImage: previewPath(path) });
	}
	return out;
}
