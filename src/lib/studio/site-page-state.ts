import { ContentConflict, publish, readPublished, runtimeToken, type RuntimeLocals } from "./runtime-content";
import { pagePath } from "./page-routes";

export type SitePageStatus = "draft" | "live";
export type SitePageStatuses = Record<string, SitePageStatus>;

const KEY = "studio/site-pages/statuses.json";
let BUNDLED: Record<string, any> = {};
try { BUNDLED = import.meta.glob("../../../content/pages/*.json", { eager: true }); } catch { BUNDLED = {}; }

function seedStatuses(): SitePageStatuses {
	return Object.fromEntries(Object.entries(BUNDLED).map(([file, mod]) => {
		const slug = file.split("/").pop()!.replace(/\.json$/, "");
		const data = (mod as any).default ?? mod;
		return [pagePath(slug), data?.status === "live" ? "live" : "draft"];
	}));
}

const EMPTY: SitePageStatuses = {};
const requestReads = new WeakMap<object, Promise<{ value: SitePageStatuses; version: string }>>();

function cleanPath(value: unknown): string | null {
	if (typeof value !== "string" || !value.startsWith("/") || value.includes("?") || value.includes("#")) return null;
	let decoded: string;
	try { decoded = decodeURIComponent(value); } catch { return null; }
	return decoded === "/" ? decoded : decoded.replace(/\/+$/, "");
}

export async function readSitePageStatuses(locals?: RuntimeLocals) {
	const load = async () => {
		const stored = await readPublished<SitePageStatuses>(KEY, EMPTY, locals);
		const saved = Object.fromEntries(Object.entries(stored.value || {}).filter(([path, status]) => cleanPath(path) && (status === "draft" || status === "live")));
		const value = { ...seedStatuses(), ...saved } as SitePageStatuses;
		return { value, version: stored.version };
	};
	if (!locals || typeof locals !== "object") return load();
	const existing = requestReads.get(locals);
	if (existing) return existing;
	const pending = load();
	requestReads.set(locals, pending);
	return pending;
}

export function sitePageStatus(path: string, statuses: SitePageStatuses, fallback: SitePageStatus = "live"): SitePageStatus {
	return statuses[cleanPath(path) || path] ?? fallback;
}

export async function sitePageDraftGuard(path: string, staff: boolean, locals?: RuntimeLocals): Promise<Response | null> {
	if (staff) return null;
	if (!runtimeToken(locals) && process.env.NODE_ENV === "production") {
		return new Response("Service unavailable", { status: 503, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
	}
	const statuses = await readSitePageStatuses(locals);
	return sitePageStatus(path, statuses.value) === "draft"
		? new Response("Not found", { status: 404, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } })
		: null;
}

export async function isSitePageDraft(path: string, locals?: RuntimeLocals): Promise<boolean> {
	const statuses = await readSitePageStatuses(locals);
	return sitePageStatus(path, statuses.value) === "draft";
}

export async function updateSitePageStatus(pathValue: unknown, status: unknown, expectedVersion: unknown, locals?: RuntimeLocals) {
	const path = cleanPath(pathValue);
	if (!path) throw new Error("That page path is not valid.");
	if (status !== "draft" && status !== "live") throw new Error("Choose Draft or Published.");
	if (typeof expectedVersion !== "string") throw new ContentConflict();
	const current = await readSitePageStatuses(locals);
	if (current.version !== expectedVersion) throw new ContentConflict();
	const next: SitePageStatuses = { ...current.value, [path]: status };
	const saved = await publish(KEY, next, EMPTY, current.version, locals);
	if (locals && typeof locals === "object") requestReads.set(locals, Promise.resolve({ value: next, version: saved.version }));
	return { status, version: saved.version };
}

export async function setSitePageStatus(path: string, status: SitePageStatus, locals?: RuntimeLocals): Promise<void> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const current = await readSitePageStatuses(locals);
		if (current.value[cleanPath(path) || path] === status) return;
		try {
			await updateSitePageStatus(path, status, current.version, locals);
			return;
		} catch (error) {
			if (!(error instanceof ContentConflict) || attempt === 4) throw error;
			if (locals && typeof locals === "object") requestReads.delete(locals);
		}
	}
}
