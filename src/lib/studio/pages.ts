// Storage + fence for builder pages.
//
// Builder pages are pure JSON documents in content/pages/<slug>.json and are
// served ONLY under /p/<slug> — so they can never collide with or overwrite a
// hand-built route. sanitizeData() is the safety fence: whatever the editor or
// the AI produces, only known block types with plain-object props survive, so
// a page document can't smuggle anything executable into the site.

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "content", "pages");

// Block types the renderer knows. Must match src/components/builder/blocks.tsx.
export const ALLOWED_BLOCKS = ["Hero", "Prose", "Cards", "Quote", "Buttons", "Spacer"] as const;

export type PageData = {
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
		root: { props: { title: String(rootProps.title || "Untitled page"), kicker: String(rootProps.kicker || "") } },
		content: cleanContent,
		zones: {},
	};
}

export async function listPages(): Promise<Array<{ slug: string; title: string }>> {
	try {
		const files = (await fs.readdir(PAGES_DIR)).filter((f) => f.endsWith(".json"));
		const out: Array<{ slug: string; title: string }> = [];
		for (const f of files) {
			const slug = f.replace(/\.json$/, "");
			if (!validSlug(slug)) continue;
			try {
				const data = JSON.parse(await fs.readFile(path.join(PAGES_DIR, f), "utf8"));
				out.push({ slug, title: String(data?.root?.props?.title || slug) });
			} catch { /* skip unreadable */ }
		}
		return out.sort((a, b) => a.slug.localeCompare(b.slug));
	} catch {
		return [];
	}
}

export async function readPage(slug: string): Promise<PageData | null> {
	if (!validSlug(slug)) return null;
	try {
		return sanitizeData(JSON.parse(await fs.readFile(path.join(PAGES_DIR, `${slug}.json`), "utf8")));
	} catch {
		return null;
	}
}

export async function writePage(slug: string, data: any): Promise<PageData> {
	if (!validSlug(slug)) throw new Error("Bad page name — use lowercase letters, numbers, and dashes.");
	const clean = sanitizeData(data);
	await fs.mkdir(PAGES_DIR, { recursive: true });
	await fs.writeFile(path.join(PAGES_DIR, `${slug}.json`), JSON.stringify(clean, null, "\t") + "\n", "utf8");
	return clean;
}
