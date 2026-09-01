// Which churches feed our calendar, and what we take from each one.
//
// This is the whole editorial decision in one file. Before it existed the
// choice lived in a script's rules — a radius, a list of traditions to avoid,
// a cap on how many churches one part of town could fill — and every one of
// those was a guess standing in for a person. Now a person makes the call in
// the panel at /studio/partners and this is what they saved.
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

/** A church we have looked at and said no to. It stops being offered. */
export type Declined = {
	churchId: string;
	name: string;
	city: string | null;
	at?: string;
};

export type Settings = {
	/** Kept so the file still explains itself after the panel has written it. */
	_comment?: string;
	globals: Globals;
	partners: Partner[];
	/**
	 * Churches we will not carry, whatever they publish. Without this the panel
	 * offers the same congregation back every time a category is opened, and the
	 * count of what is available nearby reads higher than anything we would
	 * actually use.
	 */
	declined: Declined[];
	updatedAt?: string;
};

const SEED_COMMENT =
	"Which churches feed our calendar, and which kinds of gathering we take from each. " +
	"Edited at /studio/partners on the live site; this file is the starting point a fresh " +
	"deployment reads and the copy a laptop edits. Churches under `declined` are ones we have " +
	"looked at and said no to — they stop being offered. Nothing else decides what reaches the " +
	"calendar.";

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
	const declined: Declined[] = Array.isArray(raw?.declined)
		? raw.declined
				.filter((d: any) => d && typeof d.churchId === "string" && d.churchId)
				.map((d: any) => ({
					churchId: d.churchId,
					name: String(d.name || "").trim(),
					city: d.city ?? null,
					at: d.at || undefined,
				}))
		: [];
	// A church cannot be both carried and refused; saying no wins.
	const refused = new Set(declined.map((d) => d.churchId));
	return {
		_comment: typeof raw?._comment === "string" ? raw._comment : SEED_COMMENT,
		globals,
		partners: partners.filter((p) => !refused.has(p.churchId)),
		declined,
		updatedAt: raw?.updatedAt,
	};
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
