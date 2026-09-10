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
import { ContentConflict, publish, readPublished, type RuntimeLocals } from "../studio/runtime-content";

const BLOB_PATH = "partners/settings.json";

export type Partner = {
	/** The Church Map's id for the church. The one stable handle we have. */
	churchId: string;
	name: string;
	city: string | null;
	/**
	 * We have looked at this church and would put our name next to it. Approving
	 * is the judgement; showing is the switch. An approved church counts as
	 * available on the calendar-coverage list whether or not it is showing.
	 */
	approved: boolean;
	/** Showing: off keeps the church and its choices, but puts nothing on the calendar. */
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
	/** Whether public visitors can browse ministries outside New Life. */
	showExternalMinistries: boolean;
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
	"Which churches feed our calendar, and which kinds of gathering we take from each. Edited at /studio/partners on the live site; this file is the starting point a fresh deployment reads and the copy a laptop edits. A church is approved when we would put our name next to it, and shown when its dates are actually on the calendar — approving is the judgement, showing is the switch. Churches under `declined` are ones we have said no to; they stop being offered and stop being counted.";

const DEFAULT_GLOBALS: Globals = {
	hideHousekeeping: true,
	hideOtherSundayMornings: true,
	daysAhead: 60,
	showExternalMinistries: true,
};

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
					// A church written before approving existed was, by definition, one
					// we had already approved.
					approved: p.approved !== false,
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

/** One public switch for the curated-partnership and specialised-ministry experience. */
export function externalMinistriesEnabled(settings: Settings): boolean {
	return settings.globals.showExternalMinistries !== false;
}

export function seedSettings(): Settings {
	return normalise(seed);
}

export async function readSettingsState(locals?: RuntimeLocals): Promise<{ settings: Settings; version: string }> {
	const stored = await readPublished<Settings>(BLOB_PATH, seedSettings(), locals);
	return { settings: normalise(stored.value), version: stored.version };
}

/** What the public site should use right now. Storage failures must be visible. */
export async function readSettings(locals?: RuntimeLocals): Promise<Settings> {
	return (await readSettingsState(locals)).settings;
}

/** Worker API write: versioned and fail-closed; the committed file remains seed. */
export async function writeSettingsVersioned(next: Settings, expectedVersion: string, locals?: RuntimeLocals): Promise<{ settings: Settings; version: string }> {
	const current = await readPublished<Settings>(BLOB_PATH, seedSettings(), locals);
	if (current.version !== expectedVersion) throw new ContentConflict();
	const settings = normalise({ ...next, updatedAt: new Date().toISOString() });
	const saved = await publish(BLOB_PATH, settings, seedSettings(), expectedVersion, locals);
	return { settings, version: saved.version };
}

/** The churches whose dates actually reach the calendar right now. */
export function showing(settings: Settings): Map<string, Partner> {
	const map = new Map<string, Partner>();
	for (const p of settings.partners) {
		if (p.approved && p.on && p.themes.length) map.set(p.churchId, p);
	}
	return map;
}
