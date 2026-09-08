import assert from "node:assert/strict";
import test from "node:test";
import {
	__setRuntimeContentDriverForTests,
	ContentConflict,
	publish,
	readPublished,
} from "../src/lib/studio/runtime-content.ts";
import { applyEdits, readContent, undo } from "../src/lib/studio/store.ts";
import {
	__setBundledPagesForTests,
	deletePage,
	listPages,
	readPage,
	writePage,
} from "../src/lib/studio/pages.ts";
import { publicBuilderLink } from "../src/lib/studio/page-links.ts";

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

function page(status: "draft" | "live", title: string) {
	return { status, order: 1, root: { props: { title } }, content: [] };
}

test("a page tombstone hides a repository seed from direct reads and listings", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	__setBundledPagesForTests({ "/content/pages/alpha.json": page("live", "Alpha") });
	await deletePage("alpha", "seed", locals);
	assert.equal(await readPage("alpha", locals), null);
	assert.deepEqual((await listPages(locals)).map((entry) => entry.slug), []);
});

test("an existing runtime index does not hide a newly bundled seed page", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	__setBundledPagesForTests({ "/content/pages/old.json": page("live", "Old") });
	await writePage("runtime", page("draft", "Runtime"), undefined, "seed", locals);
	__setBundledPagesForTests({
		"/content/pages/old.json": page("live", "Old"),
		"/content/pages/new-seed.json": page("live", "New seed"),
	});
	assert.deepEqual(new Set((await listPages(locals)).map((entry) => entry.slug)), new Set(["new-seed", "old", "runtime"]));
});

test("directory links follow the live runtime page status", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	__setBundledPagesForTests({ "/content/pages/partner.json": page("draft", "Partner") });
	const entry = { slug: "partner-ministry", href: "/partner" };
	let statuses = new Map((await listPages(locals)).map((listing) => [listing.slug, listing.status] as const));
	assert.equal(publicBuilderLink(entry, statuses), "/ministry/partner-ministry");
	const partner = await readPage("partner", locals);
	assert.ok(partner);
	await writePage("partner", partner, { status: "live" }, "seed", locals);
	statuses = new Map((await listPages(locals)).map((listing) => [listing.slug, listing.status] as const));
	assert.equal(publicBuilderLink(entry, statuses), "/partner");
});

test.after(() => {
	__setRuntimeContentDriverForTests();
	__setBundledPagesForTests();
});
