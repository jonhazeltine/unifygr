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

import { ContentConflict, publish, readPublished, revisions, type RuntimeLocals } from "./runtime-content";
import { previewPath } from "./site-pages";
import { BARE, MOUNTED, pagePath } from "./page-routes";
import { readSitePageStatuses, setSitePageStatus, sitePageStatus } from "./site-page-state";

export { BARE, MOUNTED } from "./page-routes";

// Build-time snapshot of all pages — the read fallback where there's no fs.
// Keep the glob call direct so Vite replaces it with the production manifest.
// Plain Node does not provide import.meta.glob, so the test runner falls back
// through the catch and uses its explicit bundled-page seam below.
let BUNDLED: Record<string, any> = {};
try {
	BUNDLED = import.meta.glob("../../../content/pages/*.json", { eager: true });
} catch {
	BUNDLED = {};
}
let bundledOverrideForTests: Record<string, any> | undefined;

/** Test-only seed seam; production always reads the bundled repository files. */
export function __setBundledPagesForTests(next?: Record<string, any>): void {
	bundledOverrideForTests = next;
}

function bundledPages(): Record<string, any> {
	return bundledOverrideForTests ?? BUNDLED;
}

// Block types the renderer knows. Must match src/components/builder/blocks.tsx.
export const ALLOWED_BLOCKS = ["Hero", "Prose", "Cards", "Quote", "Buttons", "Spacer", "Image", "Video", "FAQ", "Callout", "Profiles", "ListCards", "Feature", "CtaCards", "TapButtons", "Gallery", "PackSignupForm", "GivingEmbed"] as const;

// Builder pages mounted at REAL site routes (their .astro files render the
// page JSON). These can't be deleted from the builder — the nav links to them.
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
	for (const [key, mod] of Object.entries(bundledPages())) {
		if (key.endsWith(`/${slug}.json`)) return (mod as any).default ?? mod;
	}
	return null;
}

function bundledSlugs(): string[] {
	return Object.keys(bundledPages()).map((key) => key.split("/").pop()!.replace(/\.json$/, ""));
}
const keyFor = (slug: string) => `studio/pages/${slug}/published.json`;
// The editor's private working copy — never read by the public site. Saving
// in the Page Builder writes only here; an explicit Publish is what copies
// this into the published record above. A boolean sits in its own tiny key
// rather than being inferred by comparing draft and published content:
// diffing two independently-edited Puck documents for equality is exactly
// the trap that bit the Save/Saved button earlier (see PR #228) — Puck
// re-shapes saved data in ways that read as "different" even when nothing
// visible changed, so the flag is set and cleared explicitly instead.
const draftKeyFor = (slug: string) => `studio/pages/${slug}/draft.json`;
const draftDirtyKeyFor = (slug: string) => `studio/pages/${slug}/draft-dirty.json`;

async function updatePageIndex(
	change: (slugs: string[]) => string[],
	locals?: RuntimeLocals,
): Promise<void> {
	const seeds = bundledSlugs();
	for (let attempt = 0; attempt < 5; attempt++) {
		const index = await readPublished("studio/pages/index.json", seeds, locals);
		const next = change(index.value);
		if (next.length === index.value.length && next.every((slug, i) => slug === index.value[i])) return;
		try {
			await publish("studio/pages/index.json", next, seeds, index.version, locals);
			return;
		} catch (error) {
			if (!(error instanceof ContentConflict) || attempt === 4) throw error;
		}
	}
}

export type PageListing = {
	slug: string;
	title: string;
	description: string;
	previewImage: string;
	status: PageStatus;
	order: number;
	/** where the page is served (a mounted real route, or /p/<slug>) */
	path: string;
	/** mounted pages are part of the site structure and can't be deleted */
	mounted: boolean;
	version: string;
};

const STUDIO_THUMBNAILS: Record<string, string> = {
	"ambassador-teams": "/art/studio-thumbs/ambassador.webp",
	"meals-of-hope": "/art/studio-thumbs/meals-of-hope.webp",
	"mission-trips": "/art/studio-thumbs/mission-trips.webp",
	staff: "/art/studio-thumbs/staff.webp",
	welcome: "/art/studio-thumbs/welcome.webp",
};

// Real content pages the studio-page-previews convention has no art for yet
// (checked directly against production 2026-09-21) — "/app" is a redirect
// stub, not a page anyone lands on, so it falls back to the generic /og.png
// rather than pointing a share card at a picture that 404s.
const NO_OG_IMAGE = new Set(["/app"]);

/**
 * The share-card image (og:image / twitter:image) for whatever page is at
 * this path — the same picture already used as its thumbnail in the Studio
 * page picker, so a link to any page carries its own image when it lands in
 * Messenger, iMessage, or anywhere else that renders a link preview, instead
 * of every page sharing the one generic /og.png. Called from the layouts
 * (Interior.astro, Bare.astro) as the default `image`, so a page needs no
 * changes of its own to get this — only an explicit override opts out.
 */
export function pageOgImage(pathname: string): string | undefined {
	if (NO_OG_IMAGE.has(pathname)) return undefined;
	const slug = Object.keys(MOUNTED).find((s) => MOUNTED[s] === pathname) ?? (pathname.startsWith("/p/") ? pathname.slice(3) : undefined);
	if (slug && STUDIO_THUMBNAILS[slug]) return STUDIO_THUMBNAILS[slug];
	return previewPath(pathname);
}

export async function listPages(locals?: RuntimeLocals): Promise<PageListing[]> {
	// Listing runtime-created pages needs an index. It is updated alongside each
	// save; committed files remain the seed list on a fresh deployment.
	const seeds = bundledSlugs();
	const index = await readPublished("studio/pages/index.json", seeds, locals);
	// The index tracks runtime-created pages. Always merge it with the current
	// bundle so a later code deploy can add a seed page without losing it merely
	// because a previous runtime index already exists.
	const slugs = new Set<string>([...seeds, ...index.value]);

	const out: PageListing[] = [];
	for (const slug of slugs) {
		if (!validSlug(slug)) continue;
		const record = await readPageState(slug, locals);
		// A page with no published record yet (created but never published) has
		// no real title/description to show here except in its draft — without
		// this, a brand-new page would list as "Untitled page" until published.
		const listing = record?.hasPublished ? record : await readDraftPageState(slug, locals);
		if (listing) {
			const data = listing.data;
			out.push({
				slug,
				title: String(data.root.props.title || slug),
				description: String(data.root.props.description || data.root.props.kicker || ""),
				previewImage: STUDIO_THUMBNAILS[slug] || previewPath(MOUNTED[slug] || `/p/${slug}`),
				status: data.status,
				order: data.order,
				path: MOUNTED[slug] || `/p/${slug}`,
				mounted: Boolean(MOUNTED[slug]),
				version: record?.version ?? listing.version,
			});
		}
	}
	return out.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export async function readPage(slug: string, locals?: RuntimeLocals): Promise<PageData | null> {
	return (await readPageState(slug, locals))?.data ?? null;
}

export async function readPageState(slug: string, locals?: RuntimeLocals): Promise<{ data: PageData; version: string; hasPublished: boolean } | null> {
	if (!validSlug(slug)) return null;
	const seed = bundledPage(slug);
	const bundled = seed ?? { status: "draft", order: 0, root: { props: {} }, content: [] };
	const stored = await readPublished<PageData | null>(keyFor(slug), bundled, locals);
	// A tombstone wins over the repository seed so deleting a Builder page never
	// leaves it publicly reachable after the index changes.
	if (stored.value === null) return null;
	const data = sanitizeData(stored.value);
	const statuses = await readSitePageStatuses(locals);
	data.status = sitePageStatus(pagePath(slug), statuses.value, data.status);
	// A page seeded from the repo counts as published even before its first
	// runtime write; a brand-new page created only in the editor (no seed,
	// no blob record yet) does not — that's the one case listPages() needs
	// to fall back to draft content for, so a never-published page still
	// shows its real title instead of "Untitled page".
	return { data, version: stored.version, hasPublished: stored.exists || Boolean(seed) };
}

/**
 * The editor's working copy — a draft if one has ever been saved, else a
 * fresh copy of what's currently published (or the seed, for a page that's
 * never been published at all). Status/order always come from the published
 * record: they describe the live page, not a pending edit, so opening a
 * draft never shows the wrong pill. `dirty` is true when this draft has
 * changes the published record doesn't yet have.
 */
export async function readDraftPageState(
	slug: string,
	locals?: RuntimeLocals,
): Promise<{ data: PageData; version: string; dirty: boolean } | null> {
	if (!validSlug(slug)) return null;
	const bundled = bundledPage(slug) ?? { status: "draft", order: 0, root: { props: {} }, content: [] };
	const published = await readPageState(slug, locals);
	const fallback = published?.data ?? sanitizeData(bundled);
	const stored = await readPublished<PageData | null>(draftKeyFor(slug), fallback, locals);
	// A tombstone (the page was deleted) wins over any leftover draft.
	if (stored.value === null) return null;
	const data = sanitizeData(stored.value);
	data.status = published?.data.status ?? "draft";
	data.order = published?.data.order ?? 0;
	const dirty = await readPublished<boolean>(draftDirtyKeyFor(slug), false, locals);
	return { data, version: stored.version, dirty: dirty.value };
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
	await updatePageIndex((slugs) => slugs.includes(slug) ? slugs : [...slugs, slug], locals);
	await setSitePageStatus(pagePath(slug), clean.status, locals);
	return { data: clean, via: "runtime", version: saved.version };
}

/**
 * The editor's Save button. Writes ONLY the draft copy and marks it dirty —
 * the published page (what visitors see) is untouched until an explicit
 * Publish. Safe to call on a page that's never had a draft before; safe to
 * call on a page that's never been published at all.
 */
export async function writeDraftPage(
	slug: string,
	data: any,
	expectedVersion?: string,
	locals?: RuntimeLocals,
): Promise<SaveResult & { dirty: true }> {
	if (!validSlug(slug)) throw new Error("Bad page name — use lowercase letters, numbers, and dashes.");
	const bundled = bundledPage(slug) ?? { status: "draft", order: 0, root: { props: {} }, content: [] };
	const published = await readPageState(slug, locals);
	const fallback = published?.data ?? sanitizeData(bundled);
	const clean = sanitizeData({
		...data,
		status: published?.data.status ?? "draft",
		order: published?.data.order ?? (published ? 0 : Date.now() % 100000),
	});
	const current = await readPublished<PageData | null>(draftKeyFor(slug), fallback, locals);
	const saved = await publish(draftKeyFor(slug), clean, fallback, expectedVersion ?? current.version, locals);
	const dirtyCurrent = await readPublished<boolean>(draftDirtyKeyFor(slug), false, locals);
	await publish(draftDirtyKeyFor(slug), true, false, dirtyCurrent.version, locals);
	// A brand-new page needs to show up in the page list even before its
	// first Publish, so its author can find and finish it later.
	await updatePageIndex((slugs) => (slugs.includes(slug) ? slugs : [...slugs, slug]), locals);
	return { data: clean, via: "runtime", version: saved.version, dirty: true };
}

/**
 * The editor's Publish action: copies the current draft's content into the
 * published record and puts the page live. The draft itself is left as-is
 * (still there for the next edit) — only its dirty flag clears, since it now
 * matches what's published.
 */
export async function publishDraft(slug: string, expectedPublishedVersion?: string, locals?: RuntimeLocals): Promise<SaveResult> {
	const draft = await readDraftPageState(slug, locals);
	if (!draft) throw new Error("Nothing to publish — open the page and make a change first.");
	const result = await writePage(slug, draft.data, { status: "live" }, expectedPublishedVersion, locals);
	const dirtyCurrent = await readPublished<boolean>(draftDirtyKeyFor(slug), false, locals);
	await publish(draftDirtyKeyFor(slug), false, false, dirtyCurrent.version, locals);
	return result;
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
	// The editor only ever hands back a draft version (GET/Save both work on
	// the draft) — never the published record's — so that's what a caller's
	// expectedVersion actually means here, even for a page that's also live.
	const draftCurrent = await readPublished<PageData | null>(draftKeyFor(slug), bundled, locals);
	if (expectedVersion && expectedVersion !== draftCurrent.version) throw new ContentConflict();
	await publish<PageData | null>(draftKeyFor(slug), null, bundled, draftCurrent.version, locals);
	// Tombstone the published copy too, best-effort — the draft-version check
	// above is the real guard the user just confirmed against; a page that
	// was never published has no published record to conflict over anyway.
	const publishedCurrent = await readPublished<PageData | null>(keyFor(slug), bundled, locals);
	await publish<PageData | null>(keyFor(slug), null, bundled, publishedCurrent.version, locals).catch(() => {});
	const dirtyCurrent = await readPublished<boolean>(draftDirtyKeyFor(slug), false, locals);
	await publish(draftDirtyKeyFor(slug), false, false, dirtyCurrent.version, locals).catch(() => {});
	// Deleted runtime pages are removed from the index; their immutable versions
	// remain available for recovery.
	await updatePageIndex((entries) => entries.filter((entry) => entry !== slug), locals);
	await setSitePageStatus(pagePath(slug), "draft", locals);
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
