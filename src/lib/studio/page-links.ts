import type { PageStatus } from "./pages";

/**
 * A ministry's optional Builder-page link is public only after that page is
 * live. Drafts and removed pages fall back to the ministry detail route.
 */
export function publicBuilderLink(
	entry: { slug: string; href?: string | null },
	pageStatuses: ReadonlyMap<string, PageStatus>,
): string {
	const href = entry.href;
	if (!href) return `/ministry/${entry.slug}`;
	const slug = href.replace(/^\//, "");
	if (pageStatuses.has(slug) && pageStatuses.get(slug) !== "live") return `/ministry/${entry.slug}`;
	return href;
}
