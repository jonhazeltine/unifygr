// The ministry directory — Signature Ministries (in house) and
// Curated Partnerships (out of house).
//
// Two content files drive everything:
//   content/ministry-taxonomy.json  — the map of need (families → categories)
//   content/ministries.json         — the entries, and the curation standard
//
// Nothing here is hard-coded. Add an entry to the JSON and it appears on the
// hub, in its categories, and in its geography, with counts updating on build.

import taxonomyJson from "../../content/ministry-taxonomy.json";
import directoryJson from "../../content/ministries.json";
import rulesJson from "../../content/curation-rules.json";
import notesJson from "../../content/newlife-notes.json";
import artJson from "../../content/ministry-art.json";

export type Category = {
	slug: string;
	name: string;
};

export type Family = {
	slug: string;
	name: string;
	blurb: string;
	categories: Category[];
};

export type Handoff = {
	how: string;
	person: string | null;
};

export type CalendarLink = {
	url: string | null;
	/** ics | google | thechurches | page — how we would pull their dates in. */
	format: string | null;
	cadence: string | null;
	/** available | page-current | page-stale | none | unreachable */
	sync: string | null;
	/** What the enrichment pass actually saw, so a claim can be checked. */
	evidence?: string | null;
};

export type Entry = {
	slug: string;
	name: string;
	org?: string | null;
	/** "in" = we run it. "out" = someone else runs it and we send people. */
	house: "in" | "out";
	/**
	 * in  → signature (what we're known for) | core (we run it well for our people)
	 * out → partner (formal) | ministry-share (they lead, open to us)
	 *       | joint (led together) | recommended (we vouch) | listed (known, unverified)
	 */
	tier: string;
	categories: string[];
	summary: string;
	why?: string | null;
	/** Where this ministry meets. The church is the address, not the headline. */
	venue?: string | null;
	venueUrl?: string | null;
	bestFor?: string | null;
	area?: string | null;
	city?: string | null;
	lat?: number | null;
	lng?: number | null;
	/** What the geocoder matched, so a wrong pin can be spotted. */
	geocodedAs?: string | null;
	/** A short bio of the church, from The Church Map. */
	venueBio?: string | null;
	venueServiceTimes?: string | null;
	/** This church's page on The Church Map. */
	churchMapUrl?: string | null;
	/** Where the relationship stands: not-yet-spoken-to | in-conversation | ministry-share | joint */
	relationship?: string | null;
	rhythm?: string | null;
	href?: string | null;
	website?: string | null;
	handoff?: Handoff | null;
	calendar?: CalendarLink | null;
	/** live | proposed | reviewing | dormant */
	status: string;
	verified?: { by: string | null; on: string | null } | null;
};

export type CurationTest = { name: string; body: string; short: string };

/**
 * Calendar freshness, measured rather than assumed. Set by the enrichment pass
 * that reads each ministry's own site:
 *   available    — a real feed (.ics / Google) we can pull straight in
 *   page-current — an events page carrying dates in the current year
 *   page-stale   — an events page, but the dates have gone off
 *   none         — nothing published
 *   unreachable  — their site did not answer
 */
export const LIVE_CALENDAR = new Set(["available", "page-current"]);

const allFamilies: Family[] = taxonomyJson.families as Family[];

const forced = new Set<string>(
	(rulesJson as { specialisedOnly?: { alsoForce?: string[] } }).specialisedOnly?.alsoForce ?? [],
);

/** Every family, including the specialised ones. */
export const allFamiliesIncludingSpecialised: Family[] = allFamilies;
export const entries: Entry[] = directoryJson.entries as Entry[];
export const standard = directoryJson.standard as {
	eyebrow: string;
	title: string;
	body: string;
	tests: CurationTest[];
};

// ---- Lookups ----

export const categories: Category[] = allFamilies.flatMap((f) => f.categories);

const familyByCategory = new Map<string, Family>();
for (const family of allFamilies) {
	for (const category of family.categories) {
		familyByCategory.set(category.slug, family);
	}
}

export function getFamily(slug: string): Family | undefined {
	return allFamilies.find((f) => f.slug === slug);
}

export function getCategory(slug: string): Category | undefined {
	return categories.find((c) => c.slug === slug);
}

export function familyOf(categorySlug: string): Family | undefined {
	return familyByCategory.get(categorySlug);
}

/** What New Life itself does in an area, so a visitor never has to guess. */
export function newLifeNote(categorySlug?: string, familySlug?: string): string | null {
	const notes = notesJson as { byCategory: Record<string, string>; byFamily: Record<string, string> };
	if (categorySlug && notes.byCategory[categorySlug]) return notes.byCategory[categorySlug];
	if (familySlug && notes.byFamily[familySlug]) return notes.byFamily[familySlug];
	return null;
}

/** Why we send people out in this area. Opens every family page. */
export function curationNote(familySlug: string): string | null {
	const notes = notesJson as { curation?: Record<string, string> };
	return notes.curation?.[familySlug] ?? null;
}

/** Card art for an area. One visual language across the set. */
export function familyImage(familySlug: string): string | null {
	return (artJson as { images: Record<string, string> }).images[familySlug] ?? null;
}

export function getEntry(slug: string): Entry | undefined {
	return entries.find((e) => e.slug === slug);
}

/** Held back from browsing until someone gets us a time and a place. */
export function isListable(entry: Entry): boolean {
	return entry.status !== "no-details";
}

export function entriesInCategory(categorySlug: string): Entry[] {
	return entries.filter((e) => e.categories.includes(categorySlug) && isListable(e));
}

export function entriesInFamily(familySlug: string): Entry[] {
	const family = getFamily(familySlug);
	if (!family) return [];
	const slugs = new Set(family.categories.map((c) => c.slug));
	return entries.filter((e) => e.categories.some((c) => slugs.has(c)) && isListable(e));
}

// In-house first, then the ones we vouch for hardest, then the rest.
const TIER_ORDER = ["signature", "core", "partner", "partner-church", "ministry-share", "joint", "recommended", "listed"];

export function sortEntries(list: Entry[]): Entry[] {
	return [...list].sort((a, b) => {
		if (a.house !== b.house) return a.house === "in" ? -1 : 1;
		const ta = TIER_ORDER.indexOf(a.tier);
		const tb = TIER_ORDER.indexOf(b.tier);
		if (ta !== tb) return (ta < 0 ? 99 : ta) - (tb < 0 ? 99 : tb);
		return a.name.localeCompare(b.name);
	});
}

// ---- Counts (rendered into the copy, so the numbers can never go stale) ----

export const inHouse = entries.filter((e) => e.house === "in");
export const outOfHouse = entries.filter((e) => e.house === "out");

export const counts = {
	entries: entries.length,
	inHouse: inHouse.length,
	/** Curated Ministries means offerings, not the whole specialised shelf. */
	get outOfHouse() {
		return outOfHouse.filter(isOffering).length;
	},
	/** Everything else we would point at, which lives on the specialised list. */
	get specialised() {
		return entries.filter((e) => !isOffering(e) && isListable(e)).length;
	},
	get families() { return families.length; },
	categories: categories.length,
	/** Categories nobody on this list covers yet — the honest gaps. */
	uncovered: categories.filter((c) => entriesInCategory(c.slug).length === 0).length,
	/** Out-of-house entries a human at New Life has not confirmed yet. */
	awaitingVerification: outOfHouse.filter((e) => e.status !== "live").length,
	/** Ministries whose dates we could pull straight onto this site. */
	syncable: entries.filter((e) => LIVE_CALENDAR.has(e.calendar?.sync ?? "")).length,
};

/** What the browse counts: things you could turn up to, not the whole shelf. */
export function familyCount(familySlug: string): number {
	return entriesInFamily(familySlug).filter(isOffering).length;
}

/**
 * The line between the curated browse and the specialised list.
 *
 * An area stays in the browse if at least one ministry in it publishes dates we
 * can carry. If nobody does, it moves to the shelf. That maintains itself: as
 * curation fills an area, it comes back on its own.
 */
export const specialisedFamilies = new Set<string>(
	allFamilies
		.filter((f) => forced.has(f.slug) || familyCount(f.slug) === 0)
		.map((f) => f.slug),
);

/** The families someone browses. */
export const families: Family[] = allFamilies.filter((f) => !specialisedFamilies.has(f.slug));

/**
 * An offering is something a person can actually turn up to: ours, or a
 * ministry whose calendar feed gives us real, current dates. Everything else is
 * real and worth knowing, but it is a reference list, not an offering.
 */
export function isOffering(entry: Entry): boolean {
	return (
		entry.house === "in" ||
		entry.calendar?.format === "ics" ||
		// No feed, but we read their announcements every week and a person
		// confirms them, which is a slower version of the same promise.
		entry.calendar?.format === "watched"
	);
}

export function splitOffering(list: Entry[]): { offering: Entry[]; specialized: Entry[] } {
	return {
		offering: list.filter(isOffering),
		specialized: list.filter((e) => !isOffering(e)),
	};
}

export function hasLiveCalendar(entry: Entry): boolean {
	return LIVE_CALENDAR.has(entry.calendar?.sync ?? "");
}

/** Every ministry whose dates we could actually carry, ours first. */
export function withLiveCalendar(): Entry[] {
	return sortEntries(entries.filter(hasLiveCalendar));
}

export function familyCalendarCount(familySlug: string): number {
	return entriesInFamily(familySlug).filter(hasLiveCalendar).length;
}

// ---- Geography ----
// "Lay them out geographically where that makes sense." Areas come straight
// from the entries, so a new neighborhood appears the moment it's used.

export type AreaGroup = { area: string; entries: Entry[] };

export function byArea(): AreaGroup[] {
	const map = new Map<string, Entry[]>();
	for (const entry of outOfHouse) {
		const area = entry.area || "Elsewhere";
		if (!map.has(area)) map.set(area, []);
		map.get(area)!.push(entry);
	}
	// Biggest clusters first, so the map reads like the city does.
	return [...map.entries()]
		.map(([area, list]) => ({ area, entries: sortEntries(list) }))
		.sort((a, b) => b.entries.length - a.entries.length || a.area.localeCompare(b.area));
}

// ---- Labels ----

// One church meeting in many places, so these read as location and family
// rather than as distance.
export const TIER_LABEL: Record<string, string> = {
	signature: "Signature Ministry",
	core: "Signature Ministry",
	partner: "Curated Ministry",
	"partner-church": "Curated Ministry",
	"ministry-share": "Ministry share",
	joint: "Led together",
	recommended: "Curated Ministry",
	listed: "Curated Ministry",
};

export const STATUS_LABEL: Record<string, string> = {
	live: "Confirmed",
	reviewing: "Being verified",
	proposed: "Not yet verified",
	/** Real ministry, but it publishes no time or place we could carry. */
	"no-details": "Time and place not published",
	dormant: "Paused",
};
