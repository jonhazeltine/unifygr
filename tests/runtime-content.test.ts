import assert from "node:assert/strict";
import test from "node:test";
import { BlobPreconditionFailedError } from "@vercel/blob";
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
	updatePageMeta,
	writePage,
} from "../src/lib/studio/pages.ts";
import { publicBuilderDetailLink, publicBuilderLink } from "../src/lib/studio/page-links.ts";
import { validateImageBytes } from "../src/lib/studio/media.ts";
import { readOrgs, runtimeDirectoryEntries, writeOrgs } from "../src/lib/partners/directory.ts";
import { readSitePageStatuses, setSitePageStatus, sitePageDraftGuard, sitePageStatus, updateSitePageStatus } from "../src/lib/studio/site-page-state.ts";
import { isPagePublished, withPageVisibilityHeaders } from "../src/lib/studio/page-visibility.ts";

type Entry = { body: string; etag: string };

function memoryBlob() {
	const entries = new Map<string, Entry>();
	let sequence = 0;
	// A real BlobPreconditionFailedError, not a plain Error with a matching
	// `.name` — the SDK's own error classes never set `.name` to their class
	// name (it's inherited from Error, always "Error"), so a mock built that
	// way would validate the exact `.name`-comparison bug this suite exists
	// to catch, rather than the real SDK's actual shape.
	const conflict = () => new BlobPreconditionFailedError();
	return {
		get: async (key: string) => {
			const entry = entries.get(key);
			// Real Vercel Blob reports a WEAK etag from get() ("W/\"...\""), which
			// its own put({ifMatch}) does not accept back verbatim — confirmed
			// directly against the live store 2026-09-21 (see usableEtag() in
			// runtime-content.ts): the identical request succeeds the instant the
			// leading "W/" is stripped and fails, unconditionally, every time it
			// isn't. entries store the STRIPPED form (what a correct `ifMatch` must
			// send); get() re-adds the "W/" so this mock actually exercises that
			// gap — an unprefixed mock etag would silently validate the bug instead
			// of catching it, the same way the earlier `.name`-vs-instanceof mock
			// silently validated a different bug in this same function.
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

async function authedCookies() {
	process.env.STUDIO_PASSCODE = "runtime-content-test";
	const { grant } = await import("../src/lib/studio/auth.ts");
	let value = "";
	grant({ set: (_key: string, next: string) => { value = next; } } as any);
	return { get: () => ({ value }) } as any;
}

async function studioPost(path: string, payload: unknown, cookies: any, requestLocals: any = locals) {
	const module = await import(path);
	const response = await module.POST({
		request: new Request(`https://example.test${path}`, { method: "POST", body: JSON.stringify(payload) }),
		cookies,
		locals: requestLocals,
	} as any);
	return { status: response.status, body: await response.json() };
}

test("a brand-new key's first publish succeeds even when another request already wrote its seed record", async () => {
	// Reproduces the real bug: two requests race to publish a key for the very
	// first time. Both find `current.exists === false` and both try to write
	// the immutable seed.json record; the loser's write correctly conflicts,
	// and that conflict is supposed to be swallowed as an expected, harmless
	// race (the comment right above the check in runtime-content.ts says so) —
	// not crash the whole publish with a raw Vercel Blob error.
	const blob = memoryBlob() as any;
	__setRuntimeContentDriverForTests(blob);
	const key = "test/first-publish-race/published.json";
	// Simulate "another request already created the immutable seed" by writing
	// it directly, out of band, before this publish ever runs.
	await blob.put(`studio/revisions/${key}/seed.json`, JSON.stringify({ value: { value: 0 }, version: "seed", publishedAt: "", previousVersion: null }), {
		access: "private", contentType: "application/json", addRandomSuffix: false,
	});
	// This is the actual regression: before the fix, this threw the raw
	// "Vercel Blob: Precondition failed: ETag mismatch." error instead of
	// completing the publish.
	const result = await publish(key, { value: 1 }, { value: 0 }, undefined, locals);
	assert.equal(result.value.value, 1);
});

test("a genuine version conflict on an existing key still raises the friendly ContentConflict, not a raw SDK error", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const key = "test/stale-write/published.json";
	const first = await publish(key, { value: 0 }, { value: 0 }, undefined, locals);
	await publish(key, { value: 1 }, { value: 0 }, first.version, locals);
	await assert.rejects(
		() => publish(key, { value: 2 }, { value: 0 }, first.version, locals),
		ContentConflict,
	);
});

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

test("a draft/live flip succeeds with no version at all — the real regression", async () => {
	// This is the actual client behavior for the site-pages list's "Draft /
	// Click to publish" button and the in-editor status pill in the one real
	// case that matters: a status flip sent with no version present in the
	// request body at all (not merely a stale one — genuinely absent, as
	// `JSON.stringify` drops a key whose value is `undefined`). The route
	// used to reject every such request outright with 409, before this
	// endpoint ever reached updatePageMeta — so the button could never
	// succeed, for any page, ever. updatePageMeta still does a real
	// conditional write underneath (see the stale-version case in the test
	// above, which must keep failing), so dropping the blanket pre-check
	// doesn't remove real protection — it only removes a check that this
	// exact, common, legitimate request could never have passed.
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	__setBundledPagesForTests({ "/content/pages/meals-of-hope.json": page("draft", "Meals of Hope") });
	const cookies = await authedCookies();
	const res = await studioPost("../src/pages/api/studio/pages.ts", { slug: "meals-of-hope", status: "live" }, cookies);
	assert.equal(res.status, 200);
	assert.equal(res.body.ok, true);
	assert.equal(res.body.data.status, "live");
});

test("a stale builder metadata save cannot change public visibility", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	__setBundledPagesForTests({ "/content/pages/giving.json": page("live", "Giving") });
	const first = await writePage("giving", page("live", "Giving"), undefined, "seed", locals);
	const second = await writePage("giving", page("live", "Giving updated"), undefined, first.version, locals);
	await assert.rejects(() => updatePageMeta("giving", { status: "draft" }, first.version, locals), ContentConflict);
	assert.equal((await readPage("giving", locals))?.status, "live");
	assert.equal(sitePageStatus("/giving", (await readSitePageStatuses(locals)).value), "live");
	assert.notEqual(second.version, first.version);
});

test("hand-built pages default published and retain a versioned draft state", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const pageLocals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };
	const initial = await readSitePageStatuses(pageLocals);
	assert.equal(sitePageStatus("/about", initial.value), "live");
	const saved = await updateSitePageStatus("/about", "draft", initial.version, pageLocals);
	const current = await readSitePageStatuses(pageLocals);
	assert.equal(sitePageStatus("/about", current.value), "draft");
	assert.equal(sitePageStatus("/%61bout", current.value), "draft");
	assert.equal(current.version, saved.version);
	await assert.rejects(() => updateSitePageStatus("/about", "live", initial.version, pageLocals), ContentConflict);
});

test("shared navigation visibility follows builder drafts and tolerates malformed external links", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	__setBundledPagesForTests({ "/content/pages/giving.json": page("draft", "Giving"), "/content/pages/welcome.json": page("draft", "Welcome") });
	const pageLocals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };
	await setSitePageStatus("/giving", "draft", pageLocals);
	await setSitePageStatus("/p/welcome", "draft", pageLocals);
	assert.equal(await isPagePublished("/giving", pageLocals), false);
	assert.equal(await isPagePublished("/p/welcome", pageLocals), false);
	assert.equal(await isPagePublished("https://%", pageLocals), true);
});

test("production draft guard fails closed when status storage is not configured", async () => {
	const previousNodeEnv = process.env.NODE_ENV;
	const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
	process.env.NODE_ENV = "production";
	Reflect.deleteProperty(process.env, "BLOB_READ_WRITE_TOKEN");
	try {
		const response = await sitePageDraftGuard("/about", false);
		assert.equal(response?.status, 503);
		assert.equal(response?.headers.get("cache-control"), "no-store");
	} finally {
		if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else process.env.NODE_ENV = previousNodeEnv;
		if (previousToken === undefined) Reflect.deleteProperty(process.env, "BLOB_READ_WRITE_TOKEN"); else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
	}
});

test("page API publishes and unpublishes a hand-built page with CAS protection", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const cookies = await authedCookies();
	const pageLocals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };
	const first = await studioPost("../src/pages/api/studio/pages.ts", { sitePath: "/about", status: "draft", sitePagesVersion: "seed" }, cookies, pageLocals);
	assert.equal(first.status, 200);
	assert.equal(first.body.status, "draft");
	const stale = await studioPost("../src/pages/api/studio/pages.ts", { sitePath: "/about", status: "live", sitePagesVersion: "seed" }, cookies, pageLocals);
	assert.equal(stale.status, 409);
});

test("public middleware returns a real 404 for a hand-built draft while staff can preview it", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const pageLocals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };
	await updateSitePageStatus("/about", "draft", "seed", pageLocals);
	const publicResponse = await sitePageDraftGuard("/about", false, pageLocals);
	assert.equal(publicResponse?.status, 404);
	assert.equal(publicResponse?.headers.get("x-robots-tag"), "noindex");
	assert.equal(await sitePageDraftGuard("/about", true, pageLocals), null);
});

test("Studio-governed page responses never enter a shared cache", () => {
	const published = withPageVisibilityHeaders(new Response("page", { headers: { "cache-control": "public, s-maxage=86400" } }));
	assert.equal(published.headers.get("cache-control"), "private, no-store");
	assert.equal(published.headers.get("x-robots-tag"), null);
	const preview = withPageVisibilityHeaders(new Response("draft"), true);
	assert.equal(preview.headers.get("cache-control"), "private, no-store");
	assert.equal(preview.headers.get("x-robots-tag"), "noindex");
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
