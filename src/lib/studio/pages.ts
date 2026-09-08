// Storage + fence for builder pages.
//
// Builder pages are pure JSON documents in content/pages/<slug>.json and are
// served ONLY under /p/<slug> — so they can never collide with or overwrite a
// hand-built route. sanitizeData() is the safety fence: whatever the editor or
// the AI produces, only known block types with plain-object props survive.
//
// Each page carries `status` ("draft" = staff-only preview, "live" = public)
// and `order` (position in the page list). New pages start as drafts.
//
// Two persistence paths:
//  - Local/dev: read + write the filesystem directly (instant).
//  - Production (read-only fs, e.g. Vercel): reads come from the build-time
//    bundle; writes commit to GitHub via commitToMain(), and Vercel's rebuild
//    makes them live a minute or two later.

import { publish, readPublished, revisions, type RuntimeLocals } from "./runtime-content";

// Build-time snapshot of all pages — the read fallback where there's no fs.
const BUNDLED: Record<string, any> = import.meta.glob("../../../content/pages/*.json", { eager: true });

// Block types the renderer knows. Must match src/components/builder/blocks.tsx.
export const ALLOWED_BLOCKS = ["Hero", "Prose", "Cards", "Quote", "Buttons", "Spacer", "Image", "Video", "FAQ", "Callout", "Profiles", "ListCards", "Feature", "CtaCards", "TapButtons", "Gallery"] as const;

// Builder pages mounted at REAL site routes (their .astro files render the
// page JSON). These can't be deleted from the builder — the nav links to them.
export const MOUNTED: Record<string, string> = {
	"mission-trips": "/mission-trips",
	"membership": "/membership",
	"staff": "/staff",
	"giving": "/giving",
	"tap": "/tap",
	"next-steps": "/next-steps",
	"meals-of-hope": "/meals-of-hope",
	"ambassador-teams": "/ambassador-teams",
	"outreach-teams": "/outreach-teams",
	"go": "/go",
};

// Pages that render with no header, footer or menu — a single screen of big
// buttons. Their .astro route passes `bare` to MountedPage.
export const BARE = new Set(["tap", "next-steps"]);

export type PageStatus = "draft" | "live";

export type PageData = {
	status: PageStatus;
	order: number;
	root: { props: { title?: string; kicker?: string; description?: string } };
	content: Array<{ type: string; props: Record<string, unknown> }>;
	zones?: Record<string, unknown>;
};

export function validSlug(slug: unknown): slug is string {
	return typeof slug === "string" && /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/.test(slug);
}

export function sanitizeData(input: any): PageData {
	const allowed = new Set<string>(ALLOWED_BLOCKS);
	const content = Array.isArray(input?.content) ? input.content : [];
	let n = 0;
	const cleanContent = content
		.filter((item: any) => item && allowed.has(item.type) && typeof item.props === "object")
		.map((item: any) => ({
			type: String(item.type),
			props: {
				...item.props,
				id: typeof item.props.id === "string" ? item.props.id : `${item.type}-${++n}-${Math.random().toString(36).slice(2, 8)}`,
			},
		}));

	const rootProps = typeof input?.root?.props === "object" && input.root.props ? input.root.props : {};
	return {
		status: input?.status === "live" ? "live" : "draft",
		order: Number.isFinite(input?.order) ? Number(input.order) : 0,
		root: {
			props: {
				title: String(rootProps.title || "Untitled page"),
				kicker: String(rootProps.kicker || ""),
				description: String(rootProps.description || ""),
			},
		},
		content: cleanContent,
		zones: {},
	};
}

function bundledPage(slug: string): any | null {
	for (const [key, mod] of Object.entries(BUNDLED)) {
		if (key.endsWith(`/${slug}.json`)) return (mod as any).default ?? mod;
	}
	return null;
}

const bundledSlugs = Object.keys(BUNDLED).map((k) => k.split("/").pop()!.replace(/\.json$/, ""));
const keyFor = (slug: string) => `studio/pages/${slug}/published.json`;

export type PageListing = {
	slug: string;
	title: string;
	status: PageStatus;
	order: number;
	/** where the page is served (a mounted real route, or /p/<slug>) */
	path: string;
	/** mounted pages are part of the site structure and can't be deleted */
	mounted: boolean;
	version: string;
};

export async function listPages(locals?: RuntimeLocals): Promise<PageListing[]> {
	// Listing runtime-created pages needs an index. It is updated alongside each
	// save; committed files remain the seed list on a fresh deployment.
	const index = await readPublished("studio/pages/index.json", bundledSlugs, locals);
	const slugs = new Set<string>(index.value);

	const out: PageListing[] = [];
	for (const slug of slugs) {
		if (!validSlug(slug)) continue;
		const record = await readPageState(slug, locals);
		if (record) {
			const data = record.data;
			out.push({
				slug,
				title: String(data.root.props.title || slug),
				status: data.status,
				order: data.order,
				path: MOUNTED[slug] || `/p/${slug}`,
				mounted: Boolean(MOUNTED[slug]),
				version: record.version,
			});
		}
	}
	return out.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export async function readPage(slug: string, locals?: RuntimeLocals): Promise<PageData | null> {
	return (await readPageState(slug, locals))?.data ?? null;
}

export async function readPageState(slug: string, locals?: RuntimeLocals): Promise<{ data: PageData; version: string } | null> {
	if (!validSlug(slug)) return null;
	const bundled = bundledPage(slug) ?? { status: "draft", order: 0, root: { props: {} }, content: [] };
	const stored = await readPublished<PageData | null>(keyFor(slug), bundled, locals);
	// A tombstone wins over the repository seed so deleting a Builder page never
	// leaves it publicly reachable after the index changes.
	if (stored.value === null) return null;
	return { data: sanitizeData(stored.value), version: stored.version };
}

function serialize(data: PageData): string {
	return JSON.stringify(data, null, "\t") + "\n";
}

export type SaveResult = { data: PageData; via: "runtime"; version: string };

/**
 * Write a page. Filesystem when possible; GitHub commit in production.
 * Content saves NEVER change status/order — the stored values always win
 * (the editor's data stream doesn't carry them reliably); only the explicit
 * `meta` override (used by updatePageMeta) can flip a page live/draft.
 */
export async function writePage(
	slug: string,
	data: any,
	meta?: { status?: PageStatus; order?: number },
	expectedVersion?: string,
	locals?: RuntimeLocals,
): Promise<SaveResult> {
	if (!validSlug(slug)) throw new Error("Bad page name — use lowercase letters, numbers, and dashes.");
	const bundled = bundledPage(slug) ?? { status: "draft", order: 0, root: { props: {} }, content: [] };
	const existing = await readPage(slug, locals);
	const clean = sanitizeData({
		...data,
		status: meta?.status ?? existing?.status ?? "draft",
		order: meta?.order ?? existing?.order ?? (existing ? 0 : Date.now() % 100000),
	});
	const current = await readPublished<PageData | null>(keyFor(slug), bundled, locals);
	const saved = await publish(keyFor(slug), clean, bundled, expectedVersion ?? current.version, locals);
	const index = await readPublished("studio/pages/index.json", bundledSlugs, locals);
	if (!index.value.includes(slug)) await publish("studio/pages/index.json", [...index.value, slug], bundledSlugs, index.version, locals);
	return { data: clean, via: "runtime", version: saved.version };
}

/** Change only status/order without touching content. */
export async function updatePageMeta(slug: string, meta: { status?: PageStatus; order?: number }, expectedVersion?: string, locals?: RuntimeLocals): Promise<SaveResult> {
	const current = await readPage(slug, locals);
	if (!current) throw new Error("Page not found.");
	return writePage(slug, current, meta, expectedVersion, locals);
}

export async function deletePage(slug: string, expectedVersion?: string, locals?: RuntimeLocals): Promise<{ via: "runtime" }> {
	if (!validSlug(slug)) throw new Error("Bad page name.");
	if (MOUNTED[slug]) throw new Error("This page is part of the site's structure — it can't be deleted (unpublish it instead).");
	const bundled = bundledPage(slug) ?? { status: "draft", order: 0, root: { props: {} }, content: [] };
	const current = await readPublished(keyFor(slug), bundled, locals);
	if (expectedVersion && expectedVersion !== current.version) throw new Error("This page changed while you were editing it. Refresh and review it before publishing.");
	await publish<PageData | null>(keyFor(slug), null, bundled, current.version, locals);
	// Deleted runtime pages are removed from the index; their immutable versions
	// remain available for recovery.
	const index = await readPublished("studio/pages/index.json", bundledSlugs, locals);
	await publish("studio/pages/index.json", index.value.filter((entry) => entry !== slug), bundledSlugs, index.version, locals);
	return { via: "runtime" };
}

/**
 * The 404 for a page nobody outside staff may see.
 *
 * This has to run in the ROUTE, not in MountedPage: a Response returned from a
 * component blanks the body but leaves the status at 200, and a blank 200 is a
 * page a search engine will index. Routes return this before rendering.
 */
export async function draftGuard(slug: string, staff: boolean, locals?: RuntimeLocals): Promise<Response | null> {
	const data = await readPage(slug, locals);
	if (data && (data.status === "live" || staff)) return null;
	return new Response("Not found", { status: 404, headers: { "x-robots-tag": "noindex" } });
}
