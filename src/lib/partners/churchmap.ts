// Reading The Church Map's published Grand Rapids events.
//
// The Church Map already gathers the calendars Grand Rapids churches publish
// themselves, parses them, folds them together and tags each one with a theme:
//
//     https://thechurchmap.com/api/platforms/grandrapids/events
//
// We read that rather than re-parsing the same ICS files. Everything a church
// puts on its own calendar arrives here within a day, which is why nothing on
// our calendar has to be typed in by hand — the only decision left is which
// churches we carry and which kinds of gathering we take from each, and that
// is what the partners panel decides.

const API = "https://thechurchmap.com/api/platforms/grandrapids/events";
const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
	"(KHTML, like Gecko) Chrome/124 Safari/537.36";

export type RawEvent = {
	eventId: number;
	churchId: string;
	churchName: string;
	city: string | null;
	state: string | null;
	title: string;
	localStart: string | null;
	allDay: boolean;
	timeConfident: boolean;
	location: string | null;
	theme: string;
	cadence: string | null;
};

export type Feed = {
	events: RawEvent[];
	days: number;
	fetchedAt: string;
};

// One fetch serves every page render in the same server instance for a few
// minutes. The upstream calendar moves once a day at most, so anything shorter
// is just extra load on The Church Map.
const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; feed: Feed } | null = null;
let inflight: Promise<Feed> | null = null;

async function page(offset: number): Promise<any> {
	const res = await fetch(`${API}?theme=all&limit=100&offset=${offset}`, {
		headers: { "user-agent": UA, accept: "application/json" },
		signal: AbortSignal.timeout(20000),
	});
	if (!res.ok) throw new Error(`The Church Map returned ${res.status}`);
	return res.json();
}

async function fetchAll(): Promise<Feed> {
	const events: RawEvent[] = [];
	let offset = 0;
	let days = 60;
	// Guard rather than trust: a broken hasMore upstream must not spin forever.
	for (let i = 0; i < 30; i++) {
		const p = await page(offset);
		days = p.days ?? days;
		events.push(...(p.events ?? []));
		if (!p.hasMore) break;
		offset += 100;
	}
	return { events, days, fetchedAt: new Date().toISOString() };
}

/** The live feed, cached. Throws if The Church Map can't be reached. */
export async function feed(): Promise<Feed> {
	if (cached && Date.now() - cached.at < TTL_MS) return cached.feed;
	if (inflight) return inflight;
	inflight = fetchAll()
		.then((f) => {
			cached = { at: Date.now(), feed: f };
			return f;
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

export type ChurchRow = {
	churchId: string;
	name: string;
	city: string | null;
	total: number;
	/** theme key → how many events that church has coming up */
	themes: Record<string, number>;
	/** a few real titles, so a person can see what approving this would carry */
	sample: { title: string; theme: string; date: string }[];
	/** another church record publishing the very same calendar, if there is one */
	duplicateOf?: string;
};

/**
 * Every church currently publishing events, with what it publishes. This is
 * what the panel's church list is built from: there is no point offering a
 * church that would bring nothing.
 */
export function roster(events: RawEvent[]): ChurchRow[] {
	const by = new Map<string, ChurchRow>();
	for (const ev of events) {
		if (!ev.churchId) continue;
		let row = by.get(ev.churchId);
		if (!row) {
			row = {
				churchId: ev.churchId,
				name: (ev.churchName || "").trim(),
				city: ev.city,
				total: 0,
				themes: {},
				sample: [],
			};
			by.set(ev.churchId, row);
		}
		row.total++;
		row.themes[ev.theme] = (row.themes[ev.theme] || 0) + 1;
		if (row.sample.length < 6 && ev.title) {
			row.sample.push({
				title: ev.title.replace(/\s+/g, " ").trim().slice(0, 80),
				theme: ev.theme,
				date: (ev.localStart || "").slice(0, 10),
			});
		}
	}
	const rows = [...by.values()].sort((a, b) => a.name.localeCompare(b.name));

	// A multi-campus church is often listed once per campus upstream, each
	// record carrying the identical calendar under a different name and city.
	// Approving both would print every gathering twice, so say so plainly.
	const fingerprints = new Map<string, string>();
	for (const ev of events) {
		if (!ev.churchId || !ev.title) continue;
		const key = `${(ev.localStart || "").slice(0, 10)}|${ev.title.trim().toLowerCase()}`;
		const seen = fingerprints.get(key);
		if (seen === undefined) fingerprints.set(key, ev.churchId);
	}
	const shared = new Map<string, Map<string, number>>();
	for (const ev of events) {
		if (!ev.churchId || !ev.title) continue;
		const key = `${(ev.localStart || "").slice(0, 10)}|${ev.title.trim().toLowerCase()}`;
		const owner = fingerprints.get(key);
		if (!owner || owner === ev.churchId) continue;
		const pair = shared.get(ev.churchId) ?? new Map();
		pair.set(owner, (pair.get(owner) || 0) + 1);
		shared.set(ev.churchId, pair);
	}
	const nameOf = new Map(rows.map((r) => [r.churchId, r.name]));
	for (const row of rows) {
		const pair = shared.get(row.churchId);
		if (!pair) continue;
		const [otherId, overlap] = [...pair.entries()].sort((a, b) => b[1] - a[1])[0];
		// Only call it a duplicate when nearly the whole calendar is the same.
		if (overlap >= Math.max(3, row.total * 0.8)) {
			row.duplicateOf = nameOf.get(otherId) || undefined;
		}
	}
	return rows;
}
