import assert from "node:assert/strict";
import test from "node:test";
import { __setRuntimeContentDriverForTests, ContentConflict, publish, readPublished } from "../src/lib/studio/runtime-content.ts";
import { externalMinistriesEnabled, normalise, readSettings, readSettingsState, writeSettingsVersioned } from "../src/lib/partners/settings.ts";
import { applyEdits, undo } from "../src/lib/studio/store.ts";

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
async function cookies() { process.env.STUDIO_PASSCODE = "test"; const { grant } = await import("../src/lib/studio/auth.ts"); let value = ""; grant({ set: (_: string, v: string) => value = v } as any); return { get: () => ({ value }) } as any; }
async function post(path: string, body: any, jar: any) { const m = await import(path); const r = await m.POST({ request: new Request("https://test" + path, { method: "POST", body: JSON.stringify(body) }), cookies: jar, locals } as any); return { status: r.status, body: await r.json() }; }
async function put(path: string, body: any, jar: any) { const m = await import(path); const r = await m.PUT({ request: new Request("https://test" + path, { method: "PUT", body: JSON.stringify(body) }), cookies: jar, locals } as any); return { status: r.status, body: await r.json() }; }

test("seed revision failure prevents first pointer publish", async () => {
	const d = memory(true); __setRuntimeContentDriverForTests(d as any);
	await assert.rejects(() => publish("test/seed", { x: 1 }, { x: 0 }, "seed", locals));
	assert.equal(d.entries.has("test/seed"), false);
});

test("external ministry visibility defaults on and respects the Studio switch", () => {
	assert.equal(externalMinistriesEnabled(normalise({ globals: {}, partners: [], declined: [] })), true);
	assert.equal(externalMinistriesEnabled(normalise({ globals: { showExternalMinistries: false }, partners: [], declined: [] })), false);
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

test("the public settings reader unwraps a versioned settings save", async () => {
	const d = memory(); __setRuntimeContentDriverForTests(d as any);
	const state = await readSettingsState(locals);
	const saved = await writeSettingsVersioned({ ...state.settings, globals: { ...state.settings.globals, daysAhead: 59 } }, state.version, locals);
	assert.equal((await readSettings(locals)).globals.daysAhead, 59);
	assert.notEqual(saved.version, "seed");
});

test("transient runtime read fails closed instead of returning a writable seed", async () => {
	__setRuntimeContentDriverForTests(memory(false, true) as any);
	await assert.rejects(() => readSettingsState(locals));
});

test("undo route reports no further undo after restoring seed", async () => {
	__setRuntimeContentDriverForTests(memory() as any); const jar = await cookies();
	await applyEdits([{ path: "church.tagline", to: "changed" }], "test", "seed", locals);
	const response = await post("../src/pages/api/studio/undo.ts", {}, jar);
	assert.equal(response.status, 200); assert.equal(response.body.canUndo, false);
});

test("page delete and org saves reject stale versions with 409", async () => {
	__setRuntimeContentDriverForTests(memory() as any); const jar = await cookies();
	const page = await post("../src/pages/api/studio/pages.ts", { slug: "stale-page", data: { status: "draft", root: { props: { title: "x" } }, content: [] }, version: "seed", create: true }, jar);
	assert.equal((await post("../src/pages/api/studio/pages.ts", { slug: "stale-page", delete: true, version: "seed" }, jar)).status, 409);
	const org = await put("../src/pages/api/partners/orgs.ts", { changes: {}, version: "old" }, jar);
	assert.equal(org.status, 409); void page;
});

test.after(() => __setRuntimeContentDriverForTests());
