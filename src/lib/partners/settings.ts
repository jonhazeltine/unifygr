// Which churches feed our calendar, and what we take from each one.
//
// This is the whole editorial decision in one file. Before it existed the
// choice lived in a script's rules — a radius, a list of traditions to avoid,
// a cap on how many churches one part of town could fill — and every one of
// those was a guess standing in for a person. Now a person makes the call in
// the panel at /admin/partners and this is what they saved.
//
// Two backends, one shape. On the live site the saved settings sit in Vercel
// Blob, so a switch takes effect on the next page view without a rebuild. On a
// laptop there is no blob token, so it reads and writes the committed file.
// content/ministry-partners.json is also the seed: the first time the panel is
// opened on a fresh deployment, that file is what it starts from.

import seed from "../../../content/ministry-partners.json";

const BLOB_PATH = "partners/settings.json";

export type Partner = {
	/** The Church Map's id for the church. The one stable handle we have. */
	churchId: string;
	name: string;
	city: string | null;
	/** Off keeps the church and its choices, but carries nothing. */
	on: boolean;
	/** The Church Map theme keys we accept from this church. */
	themes: string[];
	/** Shares our own campus, so its Sunday morning is ours to point at. */
	ownCampus?: boolean;
	note?: string;
	addedAt?: string;
};

export type Globals = {
	/** Drop board meetings, room bookings, rentals and building housekeeping. */
	hideHousekeeping: boolean;
	/** Drop another church's Sunday-morning gatherings — ours are at that hour. */
	hideOtherSundayMornings: boolean;
	/** How many days ahead the calendar looks. */
	daysAhead: number;
};

export type Settings = {
	globals: Globals;
	partners: Partner[];
	updatedAt?: string;
};

const DEFAULT_GLOBALS: Globals = {
	hideHousekeeping: true,
	hideOtherSundayMornings: true,
	daysAhead: 60,
};

function blobToken(): string | undefined {
	return process.env.BLOB_READ_WRITE_TOKEN || (import.meta as any).env?.BLOB_READ_WRITE_TOKEN;
}

/** Fill in anything a stored or hand-edited file left out. */
export function normalise(raw: any): Settings {
	const globals = { ...DEFAULT_GLOBALS, ...(raw?.globals || {}) };
	globals.daysAhead = Math.max(7, Math.min(60, Number(globals.daysAhead) || 60));
	const partners: Partner[] = Array.isArray(raw?.partners)
		? raw.partners
				.filter((p: any) => p && typeof p.churchId === "string" && p.churchId)
				.map((p: any) => ({
					churchId: p.churchId,
					name: String(p.name || "").trim(),
					city: p.city ?? null,
					on: p.on !== false,
					themes: Array.isArray(p.themes) ? [...new Set(p.themes.map(String))] : [],
					ownCampus: p.ownCampus === true,
					note: p.note ? String(p.note) : undefined,
					addedAt: p.addedAt || undefined,
				}))
		: [];
	return { globals, partners, updatedAt: raw?.updatedAt };
}

export function seedSettings(): Settings {
	return normalise(seed);
}

/** What the site should use right now. Never throws: falls back to the seed. */
export async function readSettings(): Promise<Settings> {
	const token = blobToken();
	if (token) {
		try {
			const { get } = await import("@vercel/blob");
			const found = await get(BLOB_PATH, { access: "private", useCache: false, token });
			if (found) {
				const text = await new Response(found.stream).text();
				return normalise(JSON.parse(text));
			}
		} catch {
			// Nothing saved yet, or the store is unreachable. The seed is a good
			// answer to both — the calendar keeps working either way.
		}
		return seedSettings();
	}
	// Laptop: the committed file is the live copy.
	try {
		const { promises: fs } = await import("node:fs");
		const path = await import("node:path");
		const file = path.join(process.cwd(), "content", "ministry-partners.json");
		return normalise(JSON.parse(await fs.readFile(file, "utf8")));
	} catch {
		return seedSettings();
	}
}

export async function writeSettings(next: Settings): Promise<Settings> {
	const clean = normalise({ ...next, updatedAt: new Date().toISOString() });
	const body = JSON.stringify(clean, null, "\t") + "\n";
	const token = blobToken();
	if (token) {
		const { put } = await import("@vercel/blob");
		await put(BLOB_PATH, body, {
			access: "private",
			contentType: "application/json",
			addRandomSuffix: false,
			allowOverwrite: true,
			token,
		});
		return clean;
	}
	const { promises: fs } = await import("node:fs");
	const path = await import("node:path");
	await fs.writeFile(path.join(process.cwd(), "content", "ministry-partners.json"), body, "utf8");
	return clean;
}

/** Quick lookup for the calendar builder. */
export function approved(settings: Settings): Map<string, Partner> {
	const map = new Map<string, Partner>();
	for (const p of settings.partners) {
		if (p.on && p.themes.length) map.set(p.churchId, p);
	}
	return map;
}
