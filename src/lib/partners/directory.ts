// Runtime-only switches for the public ministry directory. Repository JSON is
// the seed; staff changes stay in Blob so routine curation does not deploy.
import directoryJson from "../../../content/ministries.json";
import { ContentConflict, publish, readPublished, type RuntimeLocals } from "../studio/runtime-content";
import { readSettings, type Partner, type Settings } from "./settings";

const KEY = "partners/directory-overrides.json";
type Entry = Record<string, any>;

export type EntryChurch = { churchId: string; name: string; ticked: boolean };

export type DirectoryOrg = {
	slug: string; name: string; summary: string; city: string | null; area: string | null;
	categories: string[]; offering: boolean; confirmed: boolean; listed: boolean;
	/** The church this ministry meets at, if we can tell — null for a standalone org. */
	church: EntryChurch | null;
};
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

function hostKey(value: unknown): string {
	return String(value || "")
		.toLowerCase()
		.replace(/\s*[-–—]\s*[^-–—]*\bcampus\b.*$/i, "")
		.replace(/[^a-z0-9]+/g, "")
		.trim();
}

// The Church Map's church id is the one stable handle we have (AGENTS.md:
// "the events feed carries no coordinates, and matching churches by name
// resolves ~17 of 46 — do not try it, join on the id"). Most entries now carry
// a `churchId` written at authoring time; those join directly and can never be
// confused by two campuses sharing a building name. Older entries without one
// fall back to the venue-name match, which stays ambiguity-prone for
// multi-campus churches — a gap to close by backfilling `churchId` as those
// entries are touched, not a reason to keep matching by name going forward.
//
// This is the one join every caller uses — including callers that need to see
// an UNTICKED church (the Directory tab, `ministryAvailable`), so it takes the
// full partner roster, not just the ones currently `showing()`.
export function partnerFor(entry: Entry, partners: Partner[]): Partner | undefined {
	if (entry.churchId) return partners.find((partner) => partner.churchId === entry.churchId);
	const host = hostKey(entry.venue);
	if (!host) return undefined;
	return partners.find((partner) => hostKey(partner.name) === host);
}

/**
 * Every church we can identify a ministry against, including ones we have
 * said no to. `settings.partners` drops a declined church entirely (see
 * settings.ts `normalise()` — "a church cannot be both carried and refused"),
 * so without this a declined church's ministries would find no partner match
 * and fall through to the standalone rule, becoming publicly eligible again
 * the moment someone declines the church. A declined church is neither
 * approved nor on, so `churchTicked()` is false for it here exactly as it
 * would be for any other unticked church — its ministries stay unavailable
 * and its Directory rows stay identifiable (named, locked) rather than
 * silently losing their church tie.
 */
function churchRoster(settings: Settings): Partner[] {
	const declined: Partner[] = (settings.declined || []).map((d) => ({
		churchId: d.churchId,
		name: d.name,
		city: d.city,
		approved: false,
		on: false,
		themes: [],
	}));
	return [...settings.partners, ...declined];
}

/**
 * Jon's rule, in one place: a church is "ticked" in the Curated Partnerships
 * tab when it is both approved (we'd put our name next to it) and on
 * (showing). Event THEMES are a calendar-only concern (see settings.ts
 * `showing()`) and never gate whether a ministry CARD can appear — requiring
 * theme overlap here was an extra, undocumented rule and has been removed.
 */
export function churchTicked(partner: Partner): boolean {
	return partner.approved && partner.on;
}

/**
 * The one function every public surface and the Studio Directory tab goes
 * through to decide whether a ministry tied to a church may be shown at all.
 * Jon's exact rule:
 *   - church ticked   + ministry selected (listed)   -> true  (card ON)
 *   - church ticked   + ministry not selected         -> false (OFF)
 *   - church NOT ticked (whatever "listed" says)      -> false (UNAVAILABLE)
 * A ministry with no linked church skips the church half of the rule
 * entirely and is governed by `listed` alone.
 */
export function ministryAvailable(entry: Entry, allPartners: Partner[]): boolean {
	const listed = entry.listed !== false;
	const partner = partnerFor(entry, allPartners);
	if (!partner) return listed;
	return churchTicked(partner) && listed;
}

function entryChurch(entry: Entry, allPartners: Partner[]): EntryChurch | null {
	const partner = partnerFor(entry, allPartners);
	if (!partner) return null;
	return { churchId: partner.churchId, name: partner.name, ticked: churchTicked(partner) };
}

async function applyPartnerChoices(entries: Entry[], locals?: RuntimeLocals): Promise<Entry[]> {
	const settings = await readSettings(locals);
	const roster = churchRoster(settings);
	return entries.filter((entry) => {
		if (entry.house !== "out") return true;
		const partner = partnerFor(entry, roster);
		if (!partner) return true; // no linked church: its own rule (isListable) applies elsewhere
		return churchTicked(partner);
	});
}

export async function runtimeDirectoryEntries(locals?: RuntimeLocals): Promise<Entry[]> {
	const stored = await readPublished<Record<string, OrgChange>>(KEY, {}, locals);
	return applyPartnerChoices(apply(directoryJson.entries, stored.value), locals);
}

function orgs(entries: Entry[], allPartners: Partner[]): DirectoryOrg[] {
	return entries.filter((entry) => entry.house === "out" && entry.status !== "no-details").map((entry) => ({
		slug: entry.slug, name: entry.name, summary: entry.summary || "", city: entry.city ?? null, area: entry.area ?? null,
		categories: entry.categories || [], offering: isOffering(entry), confirmed: entry.status === "live", listed: entry.listed !== false,
		church: entryChurch(entry, allPartners),
	})).sort((a, b) => a.name.localeCompare(b.name));
}

export async function readOrgs(locals?: RuntimeLocals): Promise<DirectoryState> {
	const stored = await readPublished<Record<string, OrgChange>>(KEY, {}, locals);
	const settings = await readSettings(locals);
	return { orgs: orgs(apply(directoryJson.entries, stored.value), churchRoster(settings)), version: stored.version };
}

export async function writeOrgs(changes: Record<string, OrgChange>, expectedVersion?: string, locals?: RuntimeLocals): Promise<{ touched: number; version: string }> {
	const current = await readPublished<Record<string, OrgChange>>(KEY, {}, locals);
	if (!expectedVersion || expectedVersion !== current.version) throw new ContentConflict();
	const settings = await readSettings(locals);
	const roster = churchRoster(settings);
	const before = apply(directoryJson.entries, current.value);
	const next = structuredClone(current.value);
	let touched = 0;
	// Only the slugs a save actually asked to change are touched. Looping over
	// every seed entry and rewriting `listed` for every ministry of an unticked
	// church — even ones nobody asked about — would permanently persist "off"
	// for a ministry someone had legitimately selected before its church went
	// dark, so re-ticking the church later would not bring it back. Public
	// gating (`ministryAvailable`/`applyPartnerChoices`) already hides an
	// unticked church's ministries without anyone's selection being rewritten;
	// this loop's only job for a locked entry is to refuse to persist `true`.
	for (const slug of Object.keys(changes)) {
		const seed = (directoryJson.entries as Entry[]).find((entry) => entry.slug === slug);
		if (!seed || seed.house !== "out") continue;
		const was = before.find((entry) => entry.slug === slug)!;
		const partner = partnerFor(seed, roster);
		// A ministry at an unticked (or declined) church cannot be turned ON,
		// whatever the panel sent — the church switch is the higher authority.
		// This is the server-side backstop for the UI's disabled control.
		const churchAllows = !partner || churchTicked(partner);
		const change = changes[slug]!;
		const requestedListed = change.listed ?? (was.listed !== false);
		const listed = change.listed === true && !churchAllows ? false : requestedListed;
		const confirmed = change.confirmed ?? (was.status === "live");
		if (listed !== (was.listed !== false) || confirmed !== (was.status === "live")) touched++;
		const override: OrgChange = {};
		if (listed !== (seed.listed !== false)) override.listed = listed;
		if (confirmed !== (seed.status === "live")) override.confirmed = confirmed;
		if (Object.keys(override).length) next[slug] = override;
		else delete next[slug];
	}
	if (!touched) return { touched: 0, version: current.version };
	const saved = await publish(KEY, next, {}, current.version, locals);
	return { touched, version: saved.version };
}
