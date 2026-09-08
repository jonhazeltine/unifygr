import assert from "node:assert/strict";
import test from "node:test";
import {
	__setRuntimeContentDriverForTests,
	ContentConflict,
	publish,
	readPublished,
} from "../src/lib/studio/runtime-content.ts";
import { applyEdits, readContent, undo } from "../src/lib/studio/store.ts";

type Entry = { body: string; etag: string };

function memoryBlob() {
	const entries = new Map<string, Entry>();
	let sequence = 0;
	const conflict = () => Object.assign(new Error("precondition failed"), { name: "BlobPreconditionFailedError" });
	return {
		get: async (key: string) => {
			const entry = entries.get(key);
			return entry ? { statusCode: 200 as const, stream: new Response(entry.body).body!, blob: { etag: entry.etag } } : null;
		},
		put: async (key: string, body: any, options: any) => {
			const text = await new Response(body).text();
			const existing = entries.get(key);
			if ((existing && options.ifMatch !== existing.etag) || (!existing && options.ifMatch)) throw conflict();
			if (existing && !options.ifMatch && !options.allowOverwrite) throw conflict();
			entries.set(key, { body: text, etag: `e${++sequence}` });
			return {};
		},
		list: async ({ prefix }: { prefix: string }) => ({ blobs: [...entries.keys()].filter((pathname) => pathname.startsWith(prefix)).map((pathname) => ({ pathname })) }),
	};
}

const locals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };

test("concurrent publishes from one version allow exactly one pointer update", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const key = "test/concurrency/published.json";
	const first = await publish(key, { value: 0 }, { value: 0 }, "seed", locals);
	const result = await Promise.allSettled([
		publish(key, { value: 1 }, { value: 0 }, first.version, locals),
		publish(key, { value: 2 }, { value: 0 }, first.version, locals),
	]);
	assert.equal(result.filter((item) => item.status === "fulfilled").length, 1);
	assert.equal(result.filter((item) => item.status === "rejected" && item.reason instanceof ContentConflict).length, 1);
});

test("first publish undoes to the seed and repeated undo walks backward", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const seed = await readContent(locals);
	const one = await applyEdits([{ path: "church.tagline", to: "One" }], "first", "seed", locals);
	assert.equal((await undo(locals))?.content.church.tagline, seed.church.tagline);
	const two = await applyEdits([{ path: "church.tagline", to: "Two" }], "second", "seed", locals);
	const three = await applyEdits([{ path: "church.tagline", to: "Three" }], "third", two.version.id, locals);
	assert.equal((await undo(locals))?.content.church.tagline, "Two");
	assert.equal((await undo(locals))?.content.church.tagline, seed.church.tagline);
	assert.equal(await undo(locals), null);
	void one; void three;
});

test.after(() => __setRuntimeContentDriverForTests());
