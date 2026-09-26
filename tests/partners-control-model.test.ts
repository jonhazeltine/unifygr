// Jon's exact rule for the Curated Partnerships / Directory relationship
// (see AGENTS.md "The calendar and the partners panel" and the task that
// produced this file):
//   - church ticked (approved && on)  + ministry selected (listed)   -> ON
//   - church ticked                    + ministry NOT selected        -> OFF
//   - church NOT ticked, whatever "listed" says                       -> UNAVAILABLE
// A ministry with no linked church skips the church half of the rule and is
// governed by `listed` alone (the standalone-org case, e.g. Mel Trotter).
//
// This suite exercises the exact functions every public surface and the
// Studio Directory tab go through — `churchTicked` and `ministryAvailable` in
// src/lib/partners/directory.ts — plus an end-to-end check through
// `runtimeDirectoryEntries`/`readOrgs`/`writeOrgs` with the real seed content,
// so a regression in the wiring (not just the pure function) would be caught.
import assert from "node:assert/strict";
import test from "node:test";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
	__setRuntimeContentDriverForTests,
} from "../src/lib/studio/runtime-content.ts";
import { churchTicked, ministryAvailable, partnerFor, readOrgs, runtimeDirectoryEntries, writeOrgs } from "../src/lib/partners/directory.ts";
import { readSettingsState, writeSettingsVersioned, type Partner } from "../src/lib/partners/settings.ts";
import { churchTickedLive, orgEditAllowed } from "../src/lib/partners/studio-directory-lock.ts";

type Entry = { house: "in" | "out"; listed?: boolean; venue?: string | null };

function partner(overrides: Partial<Partner> = {}): Partner {
	return {
		churchId: "test-church",
		name: "Test Community Church",
		city: "Grand Rapids",
		approved: true,
		on: true,
		themes: [],
		...overrides,
	};
}

// Same memory-Blob mock as tests/runtime-content.test.ts (see that file for
// why the etag stripping matters) — kept local so this suite has no ordering
// dependency on another test file's module-level state.
function memoryBlob() {
	const entries = new Map<string, { body: string; etag: string }>();
	let sequence = 0;
	const conflict = () => new BlobPreconditionFailedError();
	return {
		get: async (key: string) => {
			const entry = entries.get(key);
			return entry ? { statusCode: 200 as const, stream: new Response(entry.body).body!, blob: { etag: `W/${entry.etag}` } } : null;
		},
		put: async (key: string, body: any, options: any) => {
			const text = await new Response(body).text();
			const existing = entries.get(key);
			if ((existing && options.ifMatch !== existing.etag) || (!existing && options.ifMatch)) throw conflict();
			if (existing && !options.ifMatch && !options.allowOverwrite) throw conflict();
			entries.set(key, { body: text, etag: `"e${++sequence}"` });
			return {};
		},
		list: async ({ prefix }: { prefix: string }) => ({ blobs: [...entries.keys()].filter((pathname) => pathname.startsWith(prefix)).map((pathname) => ({ pathname })) }),
	};
}

const locals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };

// --- 1. churchTicked: the mapping, table-driven -----------------------------

test("churchTicked() is approved AND on — not either alone, and themes never enter it", () => {
	const cases: Array<{ approved: boolean; on: boolean; expected: boolean }> = [
		{ approved: true, on: true, expected: true },
		{ approved: true, on: false, expected: false },
		{ approved: false, on: true, expected: false },
		{ approved: false, on: false, expected: false },
	];
	for (const c of cases) {
		assert.equal(
			churchTicked(partner({ approved: c.approved, on: c.on, themes: [] })),
			c.expected,
			`approved=${c.approved} on=${c.on}`,
		);
		// Loading the church with themes must not change the answer — themes are
		// a calendar-only concern (settings.ts `showing()`), never a card gate.
		assert.equal(
			churchTicked(partner({ approved: c.approved, on: c.on, themes: ["kids", "mens"] })),
			c.expected,
			`approved=${c.approved} on=${c.on} with themes`,
		);
	}
});

// --- 2. ministryAvailable: Jon's three rules, table-driven ------------------

test("ministryAvailable() implements Jon's three rules exactly", () => {
	const linkedPartnerOn = partner({ name: "Ticked Church", approved: true, on: true });
	const linkedPartnerOff = partner({ name: "Unticked Church", approved: true, on: false });
	const allPartners = [linkedPartnerOn, linkedPartnerOff];

	const cases: Array<{ name: string; entry: Entry; expected: boolean }> = [
		{ name: "ticked church + selected ministry -> ON", entry: { house: "out", venue: "Ticked Church", listed: true }, expected: true },
		{ name: "ticked church + unselected ministry -> OFF", entry: { house: "out", venue: "Ticked Church", listed: false }, expected: false },
		{ name: "unticked church + selected ministry -> UNAVAILABLE", entry: { house: "out", venue: "Unticked Church", listed: true }, expected: false },
		{ name: "unticked church + unselected ministry -> UNAVAILABLE", entry: { house: "out", venue: "Unticked Church", listed: false }, expected: false },
		{ name: "no linked church + selected -> governed by listed alone (ON)", entry: { house: "out", venue: null, listed: true }, expected: true },
		{ name: "no linked church + unselected -> governed by listed alone (OFF)", entry: { house: "out", venue: null, listed: false }, expected: false },
	];
	for (const c of cases) {
		assert.equal(ministryAvailable(c.entry, allPartners), c.expected, c.name);
	}
});

test("partnerFor() matches by venue name across every known church, ticked or not", () => {
	const allPartners = [partner({ name: "Unticked Church", approved: false, on: false })];
	const match = partnerFor({ house: "out", venue: "Unticked Church" }, allPartners);
	assert.equal(match?.name, "Unticked Church");
	assert.equal(partnerFor({ house: "out", venue: "Nobody Church" }, allPartners), undefined);
});

// --- 3. End-to-end through the real seed content and runtime wiring --------

test("an unticked church's ministries are unavailable end-to-end, and re-ticking restores them", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);

	// anc-midweek's venue ("All Nations Church") matches a seeded partner one
	// for one; use it as the real, non-synthetic case.
	const CHURCH_NAME = "All Nations Church";
	const ENTRY_SLUG = "anc-midweek";

	const before = await runtimeDirectoryEntries(locals);
	const beforeEntry = before.find((e: any) => e.slug === ENTRY_SLUG);
	assert.ok(beforeEntry, "seed fixture anc-midweek must exist for this test to mean anything");

	// Turn the church off.
	const state = await readSettingsState(locals);
	const partnerRecord = state.settings.partners.find((p) => p.name === CHURCH_NAME);
	assert.ok(partnerRecord, "seed must carry the All Nations Church partner");
	partnerRecord!.on = false;
	await writeSettingsVersioned(state.settings, state.version, locals);

	const afterOff = await runtimeDirectoryEntries(locals);
	assert.equal(afterOff.find((e: any) => e.slug === ENTRY_SLUG), undefined, "ministry must disappear when its church is unticked");

	// The Directory tab must show it locked, with the church named.
	const orgsOff = await readOrgs(locals);
	const orgOff = orgsOff.orgs.find((o) => o.slug === ENTRY_SLUG);
	assert.ok(orgOff, "anc-midweek must still be a house=out entry with details");
	assert.equal(orgOff!.church?.name, CHURCH_NAME);
	assert.equal(orgOff!.church?.ticked, false);

	// The server refuses to select it while the church is unticked, even if asked.
	const savedWhileLocked = await writeOrgs({ [ENTRY_SLUG]: { listed: true } }, orgsOff.version, locals);
	const orgsStillLocked = await readOrgs(locals);
	assert.equal(orgsStillLocked.orgs.find((o) => o.slug === ENTRY_SLUG)?.listed, false, "listed cannot be forced true while the church is unticked");
	void savedWhileLocked;

	// Turn the church back on: the ministry reappears without anyone touching
	// its own selection.
	const state2 = await readSettingsState(locals);
	const partnerRecord2 = state2.settings.partners.find((p) => p.name === CHURCH_NAME)!;
	partnerRecord2.on = true;
	await writeSettingsVersioned(state2.settings, state2.version, locals);

	const afterOn = await runtimeDirectoryEntries(locals);
	assert.ok(afterOn.find((e: any) => e.slug === ENTRY_SLUG), "ministry must reappear once its church is re-ticked");

	const orgsOn = await readOrgs(locals);
	assert.equal(orgsOn.orgs.find((o) => o.slug === ENTRY_SLUG)?.church?.ticked, true);

	__setRuntimeContentDriverForTests();
});

test("a standalone org with no linked church is governed by `listed` alone", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const orgs = await readOrgs(locals);
	const standalone = orgs.orgs.find((o) => o.church === null);
	assert.ok(standalone, "the seed content must include at least one standalone org (e.g. Mel Trotter / Pine Rest)");
	assert.equal(standalone!.church, null);
	__setRuntimeContentDriverForTests();
});

// --- Regression: a declined church must stay identifiable and unavailable --
// (P1 review finding on PR #273: `settings.partners` drops a declined church
// entirely, so `partnerFor` found no match and the ministry fell through to
// the standalone rule — publicly eligible again the moment its church was
// declined, exactly the opposite of Jon's rule.)

test("a declined church's ministries stay unavailable and identifiable, not treated as standalone", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const CHURCH_NAME = "All Nations Church";
	const ENTRY_SLUG = "anc-midweek";

	const state = await readSettingsState(locals);
	const partnerRecord = state.settings.partners.find((p) => p.name === CHURCH_NAME);
	assert.ok(partnerRecord, "seed must carry the All Nations Church partner");
	state.settings.declined = [
		...state.settings.declined,
		{ churchId: partnerRecord!.churchId, name: partnerRecord!.name, city: partnerRecord!.city },
	];
	await writeSettingsVersioned(state.settings, state.version, locals);

	const entries = await runtimeDirectoryEntries(locals);
	assert.equal(
		entries.find((e: any) => e.slug === ENTRY_SLUG),
		undefined,
		"a declined church's ministry must stay unavailable, not fall through to the standalone (no-linked-church) rule",
	);

	const orgsState = await readOrgs(locals);
	const org = orgsState.orgs.find((o) => o.slug === ENTRY_SLUG);
	assert.ok(org, "the ministry must still exist and be identifiable in the Directory tab");
	assert.equal(org!.church?.name, CHURCH_NAME, "its church must still be named, not silently lost");
	assert.equal(org!.church?.ticked, false);

	await writeOrgs({ [ENTRY_SLUG]: { listed: true } }, orgsState.version, locals);
	const after = await readOrgs(locals);
	assert.equal(after.orgs.find((o) => o.slug === ENTRY_SLUG)?.listed, false, "cannot be forced on for a declined church either");

	__setRuntimeContentDriverForTests();
});

// --- Regression: writeOrgs must only touch the slugs it was asked about ----
// (P1 review finding on PR #273: the save loop iterated every seed entry and
// forced `listed:false` onto every ministry of an unticked church even when
// that ministry wasn't in the request, permanently overwriting a selection
// that predated the church going dark — so re-ticking the church later did
// not bring it back.)

test("writeOrgs never rewrites a ministry's stored selection unless its slug is in the request", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const CHURCH_NAME = "All Nations Church";
	const ENTRY_SLUG = "anc-midweek";

	const initial = await readOrgs(locals);
	const other = initial.orgs.find((o) => o.slug !== ENTRY_SLUG && o.church?.name !== CHURCH_NAME);
	assert.ok(other, "seed content must carry a second out-of-house entry to make an unrelated request against");

	// Select the ministry while its church is ticked.
	await writeOrgs({ [ENTRY_SLUG]: { listed: true } }, initial.version, locals);
	assert.equal((await readOrgs(locals)).orgs.find((o) => o.slug === ENTRY_SLUG)?.listed, true, "selection must stick while the church is ticked");

	// Turn its church off.
	const state = await readSettingsState(locals);
	const partnerRecord = state.settings.partners.find((p) => p.name === CHURCH_NAME)!;
	partnerRecord.on = false;
	await writeSettingsVersioned(state.settings, state.version, locals);

	// Save something else entirely — confirming an unrelated ministry.
	const beforeUnrelated = await readOrgs(locals);
	await writeOrgs({ [other!.slug]: { confirmed: true } }, beforeUnrelated.version, locals);

	const afterUnrelated = await readOrgs(locals);
	assert.equal(
		afterUnrelated.orgs.find((o) => o.slug === ENTRY_SLUG)?.listed,
		true,
		"an unrelated save must not persist listed:false onto a ministry nobody asked to change",
	);
	assert.equal(afterUnrelated.orgs.find((o) => o.slug === ENTRY_SLUG)?.church?.ticked, false, "but it still reads as locked while its church is off");

	// Public gating still hides it while the church is off, with nobody's
	// selection having been rewritten.
	assert.equal((await runtimeDirectoryEntries(locals)).find((e: any) => e.slug === ENTRY_SLUG), undefined);

	// Re-ticking the church restores it using its ORIGINAL, untouched selection.
	const state2 = await readSettingsState(locals);
	state2.settings.partners.find((p) => p.name === CHURCH_NAME)!.on = true;
	await writeSettingsVersioned(state2.settings, state2.version, locals);
	assert.ok((await runtimeDirectoryEntries(locals)).find((e: any) => e.slug === ENTRY_SLUG), "re-ticking restores the ministry from its untouched stored selection");

	__setRuntimeContentDriverForTests();
});

// --- Regression: the Studio Directory tab's lock must be LIVE, and must -----
// only ever block turning a ministry ON (P2 review findings on PR #273).

test("churchTickedLive() reads the live in-page roster (not a load-time snapshot), and a declined church is never ticked", () => {
	const partners = [
		{ churchId: "a", approved: true, on: true },
		{ churchId: "b", approved: true, on: false },
	];
	const declined = [{ churchId: "c" }];
	assert.equal(churchTickedLive(partners, declined, "a"), true);
	assert.equal(churchTickedLive(partners, declined, "b"), false);
	assert.equal(churchTickedLive(partners, declined, "c"), false, "a declined church is never ticked");
	assert.equal(churchTickedLive(partners, declined, "unknown-church"), false);

	// The whole point: toggling the SAME roster in place changes the answer
	// immediately, with no re-fetch — this is what makes the Directory tab's
	// lock live instead of frozen at the moment the tab first loaded.
	partners[1].on = true;
	assert.equal(churchTickedLive(partners, declined, "b"), true, "a church ticked earlier in the same session must unlock immediately");
});

test("orgEditAllowed() blocks only turning a locked ministry ON — confirming and turning off are always allowed", () => {
	assert.equal(orgEditAllowed(true, { listed: true }), false, "a locked ministry cannot be turned on");
	assert.equal(orgEditAllowed(true, { listed: false }), true, "turning a locked ministry off is harmless and allowed");
	assert.equal(orgEditAllowed(true, { confirmed: true }), true, "confirming (the star) is independent of the selection lock");
	assert.equal(orgEditAllowed(true, {}), true, "a patch that doesn't touch `listed` is never blocked");
	assert.equal(orgEditAllowed(false, { listed: true }), true, "an unlocked ministry can be turned on");
});
