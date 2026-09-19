import { MOUNTED, readPage } from "./pages";
import { readSitePageStatuses, sitePageStatus } from "./site-page-state";
import type { RuntimeLocals } from "./runtime-content";

const mountedByPath = new Map(Object.entries(MOUNTED).map(([slug, path]) => [path, slug]));
const requestChecks = new WeakMap<object, Map<string, Promise<boolean>>>();

function internalPath(href: string): string | null {
	try {
		const url = new URL(href, "https://newlifegr.com");
		return url.origin === "https://newlifegr.com" ? url.pathname : null;
	} catch {
		return null;
	}
}

export async function isPagePublished(href: string, locals?: RuntimeLocals): Promise<boolean> {
	const path = internalPath(href);
	if (!path) return true;
	const load = async () => {
		const slug = mountedByPath.get(path);
		if (slug) return (await readPage(slug, locals))?.status === "live";
		const statuses = await readSitePageStatuses(locals);
		return sitePageStatus(path, statuses.value) === "live";
	};
	if (!locals || typeof locals !== "object") return load();
	let checks = requestChecks.get(locals);
	if (!checks) { checks = new Map(); requestChecks.set(locals, checks); }
	const existing = checks.get(path);
	if (existing) return existing;
	const pending = load();
	checks.set(path, pending);
	return pending;
}
