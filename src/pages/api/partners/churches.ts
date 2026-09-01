// Every church currently publishing events to The Church Map, with what each
// one publishes. This is what the panel's "add a church" list is built from —
// there is no point offering a church that would bring nothing with it.
import type { APIRoute } from "astro";
import { isAuthed } from "../../../lib/studio/auth";
import { feed, roster } from "../../../lib/partners/churchmap";
import { HOUSEKEEPING, isSundayMorning } from "../../../lib/partners/calendar";
import locations from "../../../../content/church-locations.json";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
	if (!isAuthed(cookies))
		return new Response(JSON.stringify({ error: "Sign in first." }), { status: 401 });
	try {
		const live = await feed();
		// One compact row per event, carrying only what the panel needs to count
		// honestly: the two things a global switch can remove, and the date the
		// "how far ahead" setting measures. Without these the panel would promise
		// gatherings that a switch quietly drops before they reach the calendar.
		const rows = live.events
			.filter((ev) => ev.churchId && ev.title && ev.localStart)
			.map((ev) => ({
				c: ev.churchId,
				t: ev.theme || "other",
				d: ev.localStart!.slice(0, 10),
				s: isSundayMorning(ev) ? 1 : 0,
				h: HOUSEKEEPING.test(ev.title.trim()) ? 1 : 0,
				// The same gathering reaches us under more than one church record when
				// a church is listed once per campus. This is the key the calendar
				// folds them on, so the panel's totals count it once too.
				k: `${ev.localStart!.slice(0, 10)}|${ev.title.replace(/\s+/g, " ").trim().toLowerCase()}`,
			}));
		// Only the churches actually publishing need a pin, so the panel is sent
		// those and not the three thousand on file.
		const known = (locations as unknown as { churches: Record<string, [number, number, string]> }).churches;
		const where: Record<string, [number, number]> = {};
		for (const id of new Set(rows.map((r) => r.c))) {
			const found = known[id];
			if (found) where[id] = [found[0], found[1]];
		}

		return new Response(
			JSON.stringify({
				churches: roster(live.events),
				where,
				rows,
				days: live.days,
				fetchedAt: live.fetchedAt,
				total: live.events.length,
			}),
			{ headers: { "content-type": "application/json" } },
		);
	} catch (err: any) {
		return new Response(
			JSON.stringify({
				error: `Couldn't reach The Church Map just now (${err?.message || "no reason given"}). Your saved choices are untouched — try again in a minute.`,
			}),
			{ status: 502, headers: { "content-type": "application/json" } },
		);
	}
};
