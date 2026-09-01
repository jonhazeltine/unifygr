// Our calendar, assembled at request time.
//
// The Church Map supplies the gatherings; content/ministry-partners.json (or
// its saved-in-the-panel successor) decides which of them are ours to carry.
// Nothing is written down between the two, so a church that posts a new date
// on Tuesday is on our calendar on Tuesday, and a switch flipped in the panel
// shows up on the next page view.
//
// If The Church Map cannot be reached, the last built snapshot in
// content/curated-events.json is served instead. A slightly stale calendar is
// a far better page than an empty one.

import snapshot from "../../../content/curated-events.json";
import { feed, type RawEvent } from "./churchmap";
import { readSettings, showing, type Settings } from "./settings";
import { THEME_CATEGORIES, themeLabel } from "./themes";

export type CalendarEvent = {
	title: string;
	date: string;
	time: string | null;
	venue: string | null;
	city: string | null;
	theme: string;
	themeLabel: string;
	categories: string[];
	cadence: string | null;
	sort: string;
};

export type Calendar = {
	events: CalendarEvent[];
	/** theme label → how many events, across everything returned */
	themes: Record<string, number>;
	/** true when The Church Map was unreachable and the snapshot is standing in */
	stale: boolean;
	churches: number;
};

// A building's own housekeeping, and the outside groups that rent its rooms.
// None of this is a gathering anyone could turn up to, whoever posted it.
export const HOUSEKEEPING =
	/(^(office hours|board|staff|elders?|council|deacons?|trustee|committee|building use|private|setup|set up|clean ?up|rehearsal|maintenance|tops\b|al-?anon|networkers|senior neighbors|blood drive|voting|polling|activity center rental|library public hours|water aerobics|euchre|rental))|(-\s*(gym|library|music room|fellowship hall|kitchen|basement)\b)|(\broom \d)/i;

export function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clock(ev: RawEvent): string | null {
	if (ev.allDay || !ev.timeConfident) return null;
	const s = ev.localStart || "";
	if (s.length < 16) return null;
	const hh = Number(s.slice(11, 13));
	const mm = s.slice(14, 16);
	if (!Number.isFinite(hh)) return null;
	const suffix = hh < 12 ? "am" : "pm";
	return `${hh % 12 || 12}:${mm}${suffix}`.replace(":00", "");
}

export function isSundayMorning(ev: RawEvent): boolean {
	const s = ev.localStart || "";
	if (s.length < 10) return false;
	const d = new Date(`${s.slice(0, 10)}T12:00:00`);
	if (d.getDay() !== 0) return false;
	if (ev.allDay || s.length < 13) return true;
	const hh = Number(s.slice(11, 13));
	return !Number.isFinite(hh) || hh < 13;
}

function shape(ev: RawEvent): CalendarEvent {
	const theme = ev.theme || "other";
	return {
		title: (ev.title || "").replace(/\s+/g, " ").trim().slice(0, 90),
		date: (ev.localStart || "").slice(0, 10),
		time: clock(ev),
		venue: (ev.churchName || "").trim() || null,
		city: ev.city,
		theme,
		themeLabel: themeLabel(theme),
		categories: THEME_CATEGORIES[theme] || [],
		cadence: ev.cadence ?? null,
		sort: ev.localStart || "",
	};
}

/** Everything the panel's choices let through, soonest first. */
export function applySettings(events: RawEvent[], settings: Settings): CalendarEvent[] {
	const partners = showing(settings);
	const { hideHousekeeping, hideOtherSundayMornings, daysAhead } = settings.globals;

	const from = today();
	const until = new Date();
	until.setDate(until.getDate() + daysAhead);
	const to = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, "0")}-${String(until.getDate()).padStart(2, "0")}`;

	const out: CalendarEvent[] = [];
	const seen = new Set<string>();

	for (const ev of events) {
		const partner = partners.get(ev.churchId);
		if (!partner) continue;
		if (!partner.themes.includes(ev.theme || "other")) continue;

		const title = (ev.title || "").trim();
		if (!title || !ev.churchName) continue;

		const date = (ev.localStart || "").slice(0, 10);
		if (date < from || date > to) continue;

		if (hideHousekeeping && HOUSEKEEPING.test(title)) continue;
		if (hideOtherSundayMornings && !partner.ownCampus && isSundayMorning(ev)) continue;

		// The same congregation exists under more than one record upstream —
		// a multi-campus church is often listed once per campus, carrying an
		// identical calendar under a different name and city. Folding on the
		// date and title catches that; folding on the church id does not.
		const key = `${date}|${title.toLowerCase()}`;
		if (seen.has(key)) continue;
		seen.add(key);

		out.push(shape(ev));
	}

	out.sort((a, b) => a.sort.localeCompare(b.sort));
	return out;
}

function fromSnapshot(settings: Settings): CalendarEvent[] {
	const from = today();
	const until = new Date();
	until.setDate(until.getDate() + settings.globals.daysAhead);
	const to = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, "0")}-${String(until.getDate()).padStart(2, "0")}`;

	// The snapshot predates the current choices, so it is held to them before it
	// is shown: a church switched off, or a kind of gathering left unticked, must
	// not come back through the back door on the day The Church Map is down. The
	// snapshot has no church ids, so this matches on the name a reader sees.
	const allowed = new Map<string, Set<string>>();
	for (const p of settings.partners) {
		if (!p.on || !p.themes.length) continue;
		const key = p.name.trim().toLowerCase();
		const set = allowed.get(key) ?? new Set<string>();
		p.themes.forEach((t) => set.add(t));
		allowed.set(key, set);
	}

	return (snapshot as { events: any[] }).events
		.filter((e) => e.date >= from && e.date <= to)
		.filter((e) => allowed.get(String(e.venue || "").trim().toLowerCase())?.has(e.theme))
		.map((e) => ({
			title: e.title,
			date: e.date,
			time: e.time ?? null,
			venue: e.venue ?? null,
			city: e.city ?? null,
			theme: e.theme,
			themeLabel: e.themeLabel,
			categories: e.categories || [],
			cadence: e.cadence ?? null,
			sort: e.sort || `${e.date}T00:00:00`,
		}))
		.sort((a, b) => a.sort.localeCompare(b.sort));
}

/** The calendar as the site should render it right now. */
export async function calendar(): Promise<Calendar> {
	const settings = await readSettings();
	let events: CalendarEvent[];
	let stale = false;
	try {
		const live = await feed();
		events = applySettings(live.events, settings);
	} catch {
		events = fromSnapshot(settings);
		stale = true;
	}
	const themes: Record<string, number> = {};
	for (const e of events) themes[e.themeLabel] = (themes[e.themeLabel] || 0) + 1;
	return {
		events,
		themes,
		stale,
		churches: new Set(events.map((e) => e.venue).filter(Boolean)).size,
	};
}
