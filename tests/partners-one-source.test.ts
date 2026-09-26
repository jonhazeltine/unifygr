// Regression coverage for the calendar/directory "one source of truth" fix.
//
// Background: Jon's complaint was "the calendar should show what is reflected
// in the backend, and it should show it consistently across the website." The
// audit found every public page already routes through readSettings() /
// runtimeDirectoryEntries() / calendar() per request (no static-seed bypass),
// but two real bugs slipped through the rules those functions apply:
//
//  1. content/ministries.json entries sourced from The Church Map were joined
//     to a partner by matching venue NAME (directory.ts's old `partnerFor`).
//     AGENTS.md already warned against this ("matching churches by name
//     resolves ~17 of 46 — do not try it, join on the id"): two churches (or
//     two campuses of one church) that share a building name collide, and
//     whichever partner record the map iterates to first wins — silently
//     hiding the other's ministries even though the panel shows it approved,
//     on, and carrying the right theme. Fixed by joining on `churchId` first.
//  2. The partner calendar's cache header allowed `stale-while-revalidate`
//     up to an hour, so a Studio save could take up to 60 minutes to reach a
//     visitor instead of the ~5 minutes every other partner surface promises.
import assert from "node:assert/strict";
import test from "node:test";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { __setRuntimeContentDriverForTests, publish } from "../src/lib/studio/runtime-content.ts";
import { runtimeDirectoryEntries } from "../src/lib/partners/directory.ts";
import { normalise, showing, type Settings } from "../src/lib/partners/settings.ts";
import { readFile } from "node:fs/promises";

type MemoryEntry = { body: string; etag: string };

function memoryBlob() {
	const entries = new Map<string, MemoryEntry>();
	let sequence = 0;
	const conflict = () => new BlobPreconditionFailedError();
	return {
		get: async (key: string) => {
			const entry = entries.get(key);
			return entry ? { statusCode: 200 as const, stream: new Response(entry.body).body!, blob: { etag: `W/"${entry.etag}"` } } : null;
		},
		put: async (key: string, body: any, options: any) => {
			const current = entries.get(key);
			if (current && options.ifMatch && options.ifMatch !== current.etag) throw conflict();
			if (!current && options.ifMatch) throw conflict();
			entries.set(key, { body: await new Response(body).text(), etag: `e${++sequence}` });
			return { url: `blob://${key}` };
		},
		list: async ({ prefix }: { prefix: string }) => ({
			blobs: [...entries.keys()].filter((pathname) => pathname.startsWith(prefix)).map((pathname) => ({ pathname })),
		}),
	};
}

const locals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };

async function seedSettings(overrides: Partial<Settings["globals"]> = {}, partners: Settings["partners"] = [], declined: Settings["declined"] = []) {
	const settings = normalise({ globals: overrides, partners, declined });
	await publish("partners/settings.json", settings, settings, "seed", locals);
}

test("directory join: three real churches (Stones, Crossroads, Magnify Northview) resolve by church id", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	// Reproduces the chief-of-staff-reported live state: all three approved,
	// on, and carrying "mens" — plus a same-building-name second Magnify
	// campus WITHOUT mens, inserted first, which is exactly the shape that
	// breaks name-based matching (whichever partner the name resolves to
	// first wins) but must not break an id-based join.
	await seedSettings({}, [
		{ churchId: "decoy-campus", name: "Magnify Church - East Campus", city: "Grand Rapids", approved: true, on: true, themes: ["kids"] },
		{ churchId: "73005957-094a-4bc8-850d-d6143041050c", name: "Crossroads Bible Church", city: "Grand Rapids", approved: true, on: true, themes: ["care_support", "mens"] },
		{ churchId: "8ce70d32-3c9a-42f2-8fda-3d752844ea4c", name: "Magnify Church - Northview Campus", city: "Grand Rapids", approved: true, on: true, themes: ["bible_study", "family", "kids", "mens", "womens"] },
		{ churchId: "72eb675c-24a5-49f9-903e-46c3a7e8375b", name: "Stones Church", city: "Grand Rapids", approved: true, on: true, themes: ["mens"] },
	]);

	const entries = await runtimeDirectoryEntries(locals);
	const bySlug = new Map(entries.map((e) => [e.slug, e]));
	assert.ok(bySlug.has("stones-men-of-valor"), "Men of Valor (Stones Church) must be carried");
	assert.ok(bySlug.has("crossroads-band-of-brothers"), "Band of Brothers (Crossroads) must be carried");
	assert.ok(bySlug.has("magnify-northview-womens"), "Magnify Northview's own ministry must still resolve correctly");

	__setRuntimeContentDriverForTests();
});

test("directory join: a same-name decoy campus cannot steal or block another campus's ministries", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const directory = JSON.parse(await readFile(new URL("../content/ministries.json", import.meta.url), "utf8"));
	const entry = directory.entries.find((e: any) => e.slug === "magnify-northview-womens");
	assert.equal(entry.churchId, "8ce70d32-3c9a-42f2-8fda-3d752844ea4c", "seed entry must carry the real church id, not rely on name matching");

	// Decoy inserted BEFORE the real partner in iteration order, sharing the
	// name-matchable prefix "Magnify Church" but declined for the theme this
	// ministry needs.
	await seedSettings({}, [
		{ churchId: "decoy", name: "Magnify Church", city: "Grand Rapids", approved: true, on: true, themes: [] },
		{ churchId: "8ce70d32-3c9a-42f2-8fda-3d752844ea4c", name: "Magnify Church - Northview Campus", city: "Grand Rapids", approved: true, on: true, themes: ["womens"] },
	]);
	const entries = await runtimeDirectoryEntries(locals);
	assert.ok(entries.some((e) => e.slug === "magnify-northview-womens"), "the real campus's theme must win the join, not the decoy with the shorter matching name");
	__setRuntimeContentDriverForTests();
});

// ---- Table-driven: every rule settings.showing() / the directory apply,
// exercised the same way the calendar and the directory both consume it. ----
const CHURCH_ID = "11111111-1111-1111-1111-111111111111";
const BASE_PARTNER = { churchId: CHURCH_ID, name: "Test Church", city: "Grand Rapids", themes: ["mens"] };

const SHOWING_CASES: Array<{ name: string; partner: Partial<typeof BASE_PARTNER & { approved: boolean; on: boolean }>; declined?: boolean; expectShowing: boolean }> = [
	{ name: "approved + on + themed church shows", partner: { approved: true, on: true }, expectShowing: true },
	{ name: "switch off (on: false) removes the church from the calendar", partner: { approved: true, on: false }, expectShowing: false },
	{ name: "not approved removes the church even if on", partner: { approved: false, on: true }, expectShowing: false },
	{ name: "no themes selected removes the church", partner: { approved: true, on: true, themes: [] }, expectShowing: false },
	{ name: "declined church is dropped outright, whatever its own flags say", partner: { approved: true, on: true }, declined: true, expectShowing: false },
];

for (const c of SHOWING_CASES) {
	test(`settings.showing(): ${c.name}`, () => {
		const partner = { ...BASE_PARTNER, approved: true, on: true, ...c.partner };
		const settings = normalise({
			globals: {},
			partners: [partner],
			declined: c.declined ? [{ churchId: CHURCH_ID, name: partner.name, city: partner.city }] : [],
		});
		const map = showing(settings);
		assert.equal(map.has(CHURCH_ID), c.expectShowing);
	});
}

test("directory: unconfirmed entry stays listed (confirmed only affects verification labeling, not visibility)", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	await seedSettings();
	const entries = await runtimeDirectoryEntries(locals);
	const anyOutOfHouse = entries.find((e) => e.house === "out" && e.status !== "live");
	assert.ok(anyOutOfHouse, "seed data should include at least one unconfirmed (non-live) out-of-house entry");
	assert.notEqual(anyOutOfHouse!.listed, false, "an unconfirmed entry must not be implicitly unlisted");
	__setRuntimeContentDriverForTests();
});

test("directory: an entry explicitly unlisted in the Studio overrides is excluded from the listable set", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	await seedSettings();
	const before = await runtimeDirectoryEntries(locals);
	const target = before.find((e) => e.house === "out");
	assert.ok(target, "seed data should include an out-of-house entry to unlist");
	await publish("partners/directory-overrides.json", { [target!.slug]: { listed: false } }, {}, "seed", locals);
	const after = await runtimeDirectoryEntries(locals);
	assert.equal(after.find((e) => e.slug === target!.slug)?.listed, false);
	__setRuntimeContentDriverForTests();
});

test("cache headers: the partner calendar routes cap stale-while-revalidate at 300s so a Studio save is never up to an hour stale", async () => {
	const files = ["src/pages/ministries/calendar.astro", "src/pages/ministries/[family]/[category].astro"];
	for (const file of files) {
		const src = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
		const match = src.match(/cache-control["'],\s*["']([^"']+)["']/);
		assert.ok(match, `${file} should set a cache-control header`);
		const swr = Number(match![1].match(/stale-while-revalidate=(\d+)/)?.[1] ?? "0");
		assert.ok(swr <= 300, `${file}: stale-while-revalidate=${swr} exceeds the 5-minute freshness promise`);
	}
});
