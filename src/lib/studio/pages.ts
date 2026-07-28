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

import { promises as fs } from "node:fs";
import path from "node:path";
import { commitToMain } from "./github";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "content", "pages");

// Build-time snapshot of all pages — the read fallback where there's no fs.
const BUNDLED: Record<string, any> = import.meta.glob("../../../content/pages/*.json", { eager: true });

// Block types the renderer knows. Must match src/components/builder/blocks.tsx.
export const ALLOWED_BLOCKS = ["Hero", "Prose", "Cards", "Quote", "Buttons", "Spacer", "Image", "Video"] as const;

export type PageStatus = "draft" | "live";

export type PageData = {
	status: PageStatus;
	order: number;
	root: { props: { title?: string; kicker?: string } };
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
		root: { props: { title: String(rootProps.title || "Untitled page"), kicker: String(rootProps.kicker || "") } },
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

async function fsPageSlugs(): Promise<string[] | null> {
	try {
		return (await fs.readdir(PAGES_DIR)).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
	} catch {
		return null; // no fs access (or dir missing)
	}
}

export async function listPages(): Promise<Array<{ slug: string; title: string; status: PageStatus; order: number }>> {
	const fromFs = await fsPageSlugs();
	const slugs = new Set<string>(
		fromFs ?? Object.keys(BUNDLED).map((k) => k.split("/").pop()!.replace(/\.json$/, "")),
	);

	const out: Array<{ slug: string; title: string; status: PageStatus; order: number }> = [];
	for (const slug of slugs) {
		if (!validSlug(slug)) continue;
		const data = await readPage(slug);
		if (data) out.push({ slug, title: String(data.root.props.title || slug), status: data.status, order: data.order });
	}
	return out.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export async function readPage(slug: string): Promise<PageData | null> {
	if (!validSlug(slug)) return null;
	try {
		return sanitizeData(JSON.parse(await fs.readFile(path.join(PAGES_DIR, `${slug}.json`), "utf8")));
	} catch {
		const bundled = bundledPage(slug);
		return bundled ? sanitizeData(bundled) : null;
	}
}

function serialize(data: PageData): string {
	return JSON.stringify(data, null, "\t") + "\n";
}

export type SaveResult = { data: PageData; via: "fs" | "git" };

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
): Promise<SaveResult> {
	if (!validSlug(slug)) throw new Error("Bad page name — use lowercase letters, numbers, and dashes.");
	const existing = await readPage(slug);
	const clean = sanitizeData({
		...data,
		status: meta?.status ?? existing?.status ?? "draft",
		order: meta?.order ?? existing?.order ?? (existing ? 0 : Date.now() % 100000),
	});
	try {
		await fs.mkdir(PAGES_DIR, { recursive: true });
		await fs.writeFile(path.join(PAGES_DIR, `${slug}.json`), serialize(clean), "utf8");
		return { data: clean, via: "fs" };
	} catch {
		await commitToMain(
			[{ path: `content/pages/${slug}.json`, content: serialize(clean) }],
			`content: studio save page "${slug}"`,
		);
		return { data: clean, via: "git" };
	}
}

/** Change only status/order without touching content. */
export async function updatePageMeta(slug: string, meta: { status?: PageStatus; order?: number }): Promise<SaveResult> {
	const current = await readPage(slug);
	if (!current) throw new Error("Page not found.");
	return writePage(slug, current, meta);
}

export async function deletePage(slug: string): Promise<{ via: "fs" | "git" }> {
	if (!validSlug(slug)) throw new Error("Bad page name.");
	try {
		await fs.rm(path.join(PAGES_DIR, `${slug}.json`));
		return { via: "fs" };
	} catch {
		await commitToMain(
			[{ path: `content/pages/${slug}.json`, remove: true }],
			`content: studio delete page "${slug}"`,
		);
		return { via: "git" };
	}
}
