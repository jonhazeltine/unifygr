// Runtime-only switches for the public ministry directory. Repository JSON is
// the seed; staff changes stay in Blob so routine curation does not deploy.
import directoryJson from "../../../content/ministries.json";
import { ContentConflict, publish, readPublished, type RuntimeLocals } from "../studio/runtime-content";
import { showing, readSettings, type Partner } from "./settings";
import { THEME_CATEGORIES } from "./themes";

const KEY = "partners/directory-overrides.json";
type Entry = Record<string, any>;

export type DirectoryOrg = { slug: string; name: string; summary: string; city: string | null; area: string | null; categories: string[]; offering: boolean; confirmed: boolean; listed: boolean };
export type OrgChange = { listed?: boolean; confirmed?: boolean };
export type DirectoryState = { orgs: DirectoryOrg[]; version: string };

function isOffering(entry: any): boolean {
	return Boolean(entry.house === "in" || entry.handoff || entry.rhythm || entry.address || entry.calendar?.format === "ics" || entry.calendar?.format === "watched");
}

function apply(entries: Entry[], changes: Record<string, OrgChange>): Entry[] {
	return entries.map((entry) => {
		const change = changes[entry.slug];
		if (!change) return entry;
		return { ...entry, ...(change.listed === undefined ? {} : { listed: change.listed }), ...(change.confirmed === undefined ? {} : { status: change.confirmed ? "live" : "proposed" }) };
	});
}

// The Church Map contributes these entries from the same church feeds the
// calendar reads. They must follow the Studio's partner choices too; otherwise
// switching a church off removes its dates but leaves its groups in the public
// directory.
function isChurchMapEntry(entry: Entry): boolean {
	return entry.house === "out" && entry.calendar?.format === "ics" && entry.calendar?.sync === "available";
}

function hostKey(value: unknown): string {
	return String(value || "")
		.toLowerCase()
		.replace(/\s*[-–—]\s*[^-–—]*\bcampus\b.*$/i, "")
		.replace(/[^a-z0-9]+/g, "")
		.trim();
}

function partnerFor(entry: Entry, partners: Map<string, Partner>): Partner | undefined {
	const host = hostKey(entry.venue);
	if (!host) return undefined;
	return [...partners.values()].find((partner) => hostKey(partner.name) === host);
}

function accepts(entry: Entry, partner: Partner): boolean {
	const categories = new Set(Array.isArray(entry.categories) ? entry.categories.map(String) : []);
	return partner.themes.some((theme) => (THEME_CATEGORIES[theme] || []).some((category) => categories.has(category)));
}

async function applyPartnerChoices(entries: Entry[], locals?: RuntimeLocals): Promise<Entry[]> {
	const partners = showing(await readSettings(locals));
	return entries.filter((entry) => {
		if (!isChurchMapEntry(entry)) return true;
		const partner = partnerFor(entry, partners);
		return Boolean(partner && accepts(entry, partner));
	});
}

export async function runtimeDirectoryEntries(locals?: RuntimeLocals): Promise<Entry[]> {
	const stored = await readPublished<Record<string, OrgChange>>(KEY, {}, locals);
	return applyPartnerChoices(apply(directoryJson.entries, stored.value), locals);
}

function orgs(entries: Entry[]): DirectoryOrg[] {
	return entries.filter((entry) => entry.house === "out" && entry.status !== "no-details").map((entry) => ({
		slug: entry.slug, name: entry.name, summary: entry.summary || "", city: entry.city ?? null, area: entry.area ?? null,
		categories: entry.categories || [], offering: isOffering(entry), confirmed: entry.status === "live", listed: entry.listed !== false,
	})).sort((a, b) => a.name.localeCompare(b.name));
}

export async function readOrgs(locals?: RuntimeLocals): Promise<DirectoryState> {
	const stored = await readPublished<Record<string, OrgChange>>(KEY, {}, locals);
	return { orgs: orgs(apply(directoryJson.entries, stored.value)), version: stored.version };
}

export async function writeOrgs(changes: Record<string, OrgChange>, expectedVersion?: string, locals?: RuntimeLocals): Promise<{ touched: number; version: string }> {
	const current = await readPublished<Record<string, OrgChange>>(KEY, {}, locals);
	if (!expectedVersion || expectedVersion !== current.version) throw new ContentConflict();
	const before = apply(directoryJson.entries, current.value);
	const next = structuredClone(current.value);
	let touched = 0;
	for (const seed of directoryJson.entries as Entry[]) {
		const change = changes[seed.slug];
		if (!change || seed.house !== "out") continue;
		const was = before.find((entry) => entry.slug === seed.slug)!;
		const listed = change.listed ?? (was.listed !== false);
		const confirmed = change.confirmed ?? (was.status === "live");
		if (listed !== (was.listed !== false) || confirmed !== (was.status === "live")) touched++;
		const override: OrgChange = {};
		if (listed !== (seed.listed !== false)) override.listed = listed;
		if (confirmed !== (seed.status === "live")) override.confirmed = confirmed;
		if (Object.keys(override).length) next[seed.slug] = override;
		else delete next[seed.slug];
	}
	if (!touched) return { touched: 0, version: current.version };
	const saved = await publish(KEY, next, {}, current.version, locals);
	return { touched, version: saved.version };
}
