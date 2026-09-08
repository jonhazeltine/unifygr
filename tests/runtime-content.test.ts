import assert from "node:assert/strict";
import test from "node:test";
import {
	__setRuntimeContentDriverForTests,
	ContentConflict,
	publish,
	readPublished,
} from "../src/lib/studio/runtime-content.ts";
import { applyEdits, readContent, readContentSnapshot, undo } from "../src/lib/studio/store.ts";
import {
	__setBundledPagesForTests,
	deletePage,
	listPages,
	readPage,
	writePage,
} from "../src/lib/studio/pages.ts";
import { publicBuilderDetailLink, publicBuilderLink } from "../src/lib/studio/page-links.ts";
import { validateImageBytes } from "../src/lib/studio/media.ts";
import { readOrgs, runtimeDirectoryEntries, writeOrgs } from "../src/lib/partners/directory.ts";

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

async function authedCookies() {
	process.env.STUDIO_PASSCODE = "runtime-content-test";
	const { grant } = await import("../src/lib/studio/auth.ts");
	let value = "";
	grant({ set: (_key: string, next: string) => { value = next; } } as any);
	return { get: () => ({ value }) } as any;
}

async function studioPost(path: string, payload: unknown, cookies: any) {
	const module = await import(path);
	const response = await module.POST({
		request: new Request(`https://example.test${path}`, { method: "POST", body: JSON.stringify(payload) }),
		cookies,
		locals,
	} as any);
	return { status: response.status, body: await response.json() };
}

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

test("content snapshots bind the published value to its exact version", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const saved = await applyEdits([{ path: "church.tagline", to: "Snapshot" }], "snapshot", "seed", locals);
	const snapshot = await readContentSnapshot(locals);
	assert.equal(snapshot.content.church.tagline, "Snapshot");
	assert.equal(snapshot.version, saved.version.id);
});

test("apply API returns 409 for a stale content version", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const cookies = await authedCookies();
	const first = await studioPost("../src/pages/api/studio/apply.ts", {
		edits: [{ path: "church.tagline", to: "Fresh" }], summary: "fresh", version: "seed",
	}, cookies);
	assert.equal(first.status, 200);
	assert.equal(first.body.content.church.tagline, "Fresh");
	const stale = await studioPost("../src/pages/api/studio/apply.ts", {
		edits: [{ path: "church.tagline", to: "Stale" }], summary: "stale", version: "seed",
	}, cookies);
	assert.equal(stale.status, 409);
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

test("concurrent new pages merge into the runtime index", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	__setBundledPagesForTests({});
	await Promise.all([
		writePage("first-page", page("draft", "First"), undefined, "seed", locals),
		writePage("second-page", page("draft", "Second"), undefined, "seed", locals),
	]);
	assert.deepEqual(new Set((await listPages(locals)).map((entry) => entry.slug)), new Set(["first-page", "second-page"]));
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
	assert.equal(publicBuilderDetailLink(entry, statuses), "/partner");
	const liveVersion = (await listPages(locals)).find((listing) => listing.slug === "partner")!.version;
	await writePage("partner", partner, { status: "draft" }, liveVersion, locals);
	statuses = new Map((await listPages(locals)).map((listing) => [listing.slug, listing.status] as const));
	assert.equal(publicBuilderDetailLink(entry, statuses), undefined);
	assert.equal(publicBuilderDetailLink(entry, statuses, true), undefined);
});

test("nav API returns a fresh version for the next save and rejects a stale client", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const cookies = await authedCookies();
	const first = await studioPost("../src/pages/api/studio/nav.ts", { nav: { groups: [], cta: { label: "One", href: "/" } }, version: "seed" }, cookies);
	assert.equal(first.status, 200);
	assert.equal(typeof first.body.version, "string");
	const second = await studioPost("../src/pages/api/studio/nav.ts", { nav: { groups: [], cta: { label: "Two", href: "/" } }, version: first.body.version }, cookies);
	assert.equal(second.status, 200);
	assert.notEqual(second.body.version, first.body.version);
	const stale = await studioPost("../src/pages/api/studio/nav.ts", { nav: { groups: [], cta: { label: "Old", href: "/" } }, version: "seed" }, cookies);
	assert.equal(stale.status, 409);
});

test("page API returns a fresh version for content and metadata saves", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	__setBundledPagesForTests({});
	const cookies = await authedCookies();
	const first = await studioPost("../src/pages/api/studio/pages.ts", { slug: "api-flow", data: page("draft", "One"), version: "seed", create: true }, cookies);
	assert.equal(first.status, 200);
	assert.equal(typeof first.body.version, "string");
	const second = await studioPost("../src/pages/api/studio/pages.ts", { slug: "api-flow", data: page("draft", "Two"), version: first.body.version }, cookies);
	assert.equal(second.status, 200);
	assert.equal(typeof second.body.version, "string");
	const meta = await studioPost("../src/pages/api/studio/pages.ts", { slug: "api-flow", status: "live", version: second.body.version }, cookies);
	assert.equal(meta.status, 200);
	assert.equal(meta.body.data.status, "live");
	const stale = await studioPost("../src/pages/api/studio/pages.ts", { slug: "api-flow", status: "draft", version: first.body.version }, cookies);
	assert.equal(stale.status, 409);
});

test("media accepts only bytes that match its fixed response image type", () => {
	assert.equal(validateImageBytes("photo.png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
	assert.throws(() => validateImageBytes("active.png", new TextEncoder().encode("<svg onload=alert(1)>")));
});

test("partner directory saves runtime overrides with a version and keeps them out of Git", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const initial = await readOrgs(locals);
	const org = initial.orgs[0];
	const saved = await writeOrgs({ [org.slug]: { listed: !org.listed } }, initial.version, locals);
	assert.notEqual(saved.version, initial.version);
	assert.equal((await runtimeDirectoryEntries(locals)).find((entry) => entry.slug === org.slug)?.listed, !org.listed);
	await assert.rejects(() => writeOrgs({ [org.slug]: { listed: org.listed } }, initial.version, locals), ContentConflict);
});

test.after(() => {
	__setRuntimeContentDriverForTests();
	__setBundledPagesForTests();
});
