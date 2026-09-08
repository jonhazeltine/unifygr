import type { PageStatus } from "./pages";

/**
 * A ministry's optional Builder-page link is public only after that page is
 * live. Drafts and removed pages fall back to the ministry detail route.
 */
export function publicBuilderLink(
	entry: { slug: string; href?: string | null },
	pageStatuses: ReadonlyMap<string, PageStatus>,
	removed = false,
): string {
	const href = entry.href;
	if (!href) return `/ministry/${entry.slug}`;
	const slug = href.replace(/^\//, "");
	if (removed || (pageStatuses.has(slug) && pageStatuses.get(slug) !== "live")) return `/ministry/${entry.slug}`;
	return href;
}

/** The detail-page action has no safe fallback when its Builder target is not public. */
export function publicBuilderDetailLink(
	entry: { href?: string | null },
	pageStatuses: ReadonlyMap<string, PageStatus>,
	removed = false,
): string | undefined {
	const href = entry.href;
	if (!href || removed) return undefined;
	const slug = href.replace(/^\//, "");
	if (pageStatuses.has(slug) && pageStatuses.get(slug) !== "live") return undefined;
	return href;
}
