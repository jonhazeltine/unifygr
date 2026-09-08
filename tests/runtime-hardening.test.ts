import assert from "node:assert/strict";
import test from "node:test";
import { __setRuntimeContentDriverForTests, ContentConflict, publish, readPublished } from "../src/lib/studio/runtime-content.ts";
import { readSettingsState, writeSettingsVersioned } from "../src/lib/partners/settings.ts";

type Entry = { body: string; etag: string };
function memory(failSeed = false, failRead = false) {
	const entries = new Map<string, Entry>(); let n = 0;
	return {
		entries,
		get: async (key: string) => { if (failRead) throw new Error("outage"); const e = entries.get(key); return e ? { statusCode: 200 as const, stream: new Response(e.body).body!, blob: { etag: e.etag } } : null; },
		put: async (key: string, body: any, opts: any) => { if (failSeed && key.endsWith("/seed.json")) throw new Error("outage"); const old = entries.get(key); if ((old && opts.ifMatch !== old.etag) || (!old && opts.ifMatch) || (old && !opts.ifMatch && !opts.allowOverwrite)) throw Object.assign(new Error("precondition"), { name: "BlobPreconditionFailedError" }); entries.set(key, { body: await new Response(body).text(), etag: `e${++n}` }); return {}; },
		list: async () => ({ blobs: [] }),
	};
}
const locals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };

test("seed revision failure prevents first pointer publish", async () => {
	const d = memory(true); __setRuntimeContentDriverForTests(d as any);
	await assert.rejects(() => publish("test/seed", { x: 1 }, { x: 0 }, "seed", locals));
	assert.equal(d.entries.has("test/seed"), false);
});

test("legacy settings are read as seed then CAS-wrapped once", async () => {
	const d = memory(); d.entries.set("partners/settings.json", { body: JSON.stringify({ globals: {}, partners: [], declined: [] }), etag: "legacy" }); __setRuntimeContentDriverForTests(d as any);
	const first = await readSettingsState(locals); assert.equal(first.version, "seed");
	const saved = await writeSettingsVersioned(first.settings, first.version, locals);
	assert.notEqual(saved.version, "seed");
	assert.equal((await readPublished<any>("partners/settings.json", {}, locals)).version, saved.version);
});

test("a stale settings save is rejected after another client saves", async () => {
	const d = memory(); __setRuntimeContentDriverForTests(d as any);
	const seed = await readSettingsState(locals);
	await writeSettingsVersioned(seed.settings, seed.version, locals);
	const state = await readSettingsState(locals);
	await writeSettingsVersioned(state.settings, state.version, locals);
	await assert.rejects(() => writeSettingsVersioned(state.settings, state.version, locals), ContentConflict);
});

test("transient runtime read fails closed instead of returning a writable seed", async () => {
	__setRuntimeContentDriverForTests(memory(false, true) as any);
	await assert.rejects(() => readSettingsState(locals));
});

test.after(() => __setRuntimeContentDriverForTests());
