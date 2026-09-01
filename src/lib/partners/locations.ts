// Where each church is, for the partners panel's maps.
//
// The events feed carries no coordinates, and matching a church by name only
// resolves about a third of them — two records for the same congregation, a
// campus suffix on one and not the other — so the join has to be on The Church
// Map's church id.
//
// Three sources, in order, all keyed by that id:
//
//   1. content/church-funnel.json      every church within 20 miles of us
//   2. content/church-candidates.json  the scored curation worklist
//   3. content/church-locations.json   the handful the first two miss, which is
//                                      almost entirely churches beyond 20 miles
//                                      that the events feed still reaches
//
// The first two were already in the repo for other work; this only reaches for
// the third when they come up short. Refresh it with
// scripts/refresh-church-locations.py.

import funnel from "../../../content/church-funnel.json";
import candidates from "../../../content/church-candidates.json";
import extra from "../../../content/church-locations.json";

type Located = { id?: string; lat?: number | null; lng?: number | null };

let cache: Map<string, [number, number]> | null = null;

function build(): Map<string, [number, number]> {
	const map = new Map<string, [number, number]>();
	for (const source of [funnel, candidates] as { churches: Located[] }[]) {
		for (const c of source.churches) {
			if (!c.id || c.lat == null || c.lng == null) continue;
			if (!map.has(c.id)) map.set(c.id, [c.lat, c.lng]);
		}
	}
	const top = (extra as unknown as { churches: Record<string, [number, number, string]> }).churches;
	for (const [id, at] of Object.entries(top)) {
		if (!map.has(id)) map.set(id, [at[0], at[1]]);
	}
	return map;
}

/** Coordinates for the given church ids. Anything unknown is simply absent. */
export function locate(ids: Iterable<string>): Record<string, [number, number]> {
	cache ??= build();
	const out: Record<string, [number, number]> = {};
	for (const id of ids) {
		const at = cache.get(id);
		if (at) out[id] = at;
	}
	return out;
}
