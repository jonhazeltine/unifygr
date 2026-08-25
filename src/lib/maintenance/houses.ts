// Which house a resident lives in, and where its tasks go in Asana.
//
// Nothing here is hard-coded about actual people or houses: residents are
// grouped into "<House> Residents" lists inside the Clearstream Residents
// account, and the house-to-Asana-project mapping is configuration
// (ASANA_HOUSE_PROJECTS), so no internal ids or resident data live in the repo.

import { listsFor, subscriberByNumber } from "../clearstream/client";

const SUFFIX = / residents$/i;

/** House names as Clearstream knows them, e.g. "Launch House". */
export async function houseNames(): Promise<string[]> {
	const lists = await listsFor("residents");
	return lists
		.filter((l) => SUFFIX.test(l.name) && !/^all /i.test(l.name))
		.map((l) => l.name.replace(SUFFIX, "").trim());
}

/** Asana project gid for a house, from ASANA_HOUSE_PROJECTS (JSON object). */
export function houseProject(house: string): string | null {
	let map: Record<string, string> = {};
	try {
		map = JSON.parse(process.env.ASANA_HOUSE_PROJECTS || "{}");
	} catch {
		return null;
	}
	const hit = Object.keys(map).find((k) => k.toLowerCase() === house.toLowerCase());
	return hit ? map[hit] : (map["*"] ?? null);
}

export type Resident = {
	name: string | null;
	mobile_number: string;
	house: string | null;
};

/** Look a resident up by the number they texted from. */
export async function identifyResident(number: string): Promise<Resident> {
	const sub = await subscriberByNumber(number, "residents");
	if (!sub) return { name: null, mobile_number: number, house: null };

	const houseList = (sub.lists ?? []).find(
		(l) => SUFFIX.test(l.name) && !/^all /i.test(l.name),
	);
	return {
		name: sub.full_name || [sub.first, sub.last].filter(Boolean).join(" ") || null,
		mobile_number: sub.mobile_number,
		house: houseList ? houseList.name.replace(SUFFIX, "").trim() : null,
	};
}
