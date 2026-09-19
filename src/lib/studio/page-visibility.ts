import { readSitePageStatuses, sitePageStatus } from "./site-page-state";
import type { RuntimeLocals } from "./runtime-content";

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

export function withPageVisibilityHeaders(response: Response, draftPreview = false): Response {
	const headers = new Headers(response.headers);
	headers.set("cache-control", "private, no-store");
	if (draftPreview) headers.set("x-robots-tag", "noindex");
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
