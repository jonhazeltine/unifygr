import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import {
	__setBundledPagesForTests,
	readDraftPageState,
	readPage,
	resolvePageSlugFromPath,
	sanitizeData,
	writeDraftPage,
	writePage,
	type PageData,
} from "../src/lib/studio/pages.ts";
import { __setRuntimeContentDriverForTests, ContentConflict } from "../src/lib/studio/runtime-content.ts";
import { __setAnthropicFetchForTests } from "../src/lib/studio/anthropic.ts";
import { proposePageEdit } from "../src/lib/studio/page-brain.ts";
import { diffPageBlocks, summarizeBlock } from "../src/lib/studio/page-diff.ts";

type Entry = { body: string; etag: string };

function memoryBlob() {
	const entries = new Map<string, Entry>();
	let sequence = 0;
	return {
		get: async (key: string) => {
			const entry = entries.get(key);
			return entry ? { statusCode: 200 as const, stream: new Response(entry.body).body!, blob: { etag: entry.etag } } : null;
		},
		put: async (key: string, body: any, options: any) => {
			const text = await new Response(body).text();
			const existing = entries.get(key);
			if ((existing && options.ifMatch !== existing.etag) || (!existing && options.ifMatch)) {
				throw Object.assign(new Error("precondition"), { name: "BlobPreconditionFailedError" });
			}
			if (existing && !options.ifMatch && !options.allowOverwrite) {
				throw Object.assign(new Error("precondition"), { name: "BlobPreconditionFailedError" });
			}
			entries.set(key, { body: text, etag: `"e${++sequence}"` });
			return {};
		},
		list: async ({ prefix }: { prefix: string }) => ({
			blobs: [...entries.keys()].filter((pathname) => pathname.startsWith(prefix)).map((pathname) => ({ pathname })),
		}),
	};
}

const locals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };

async function authedCookies() {
	process.env.STUDIO_PASSCODE = "page-ai-test";
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

function tool(input: Record<string, unknown>) {
	return async () => new Response(JSON.stringify({ content: [{ type: "tool_use", input }] }), { status: 200, headers: { "content-type": "application/json" } });
}

function page(status: "draft" | "live", title: string, content: PageData["content"] = []): PageData {
	return sanitizeData({ status, order: 1, root: { props: { title } }, content });
}

const originalApiKey = process.env.ANTHROPIC_API_KEY;

describe("Studio page-level AI editing", () => {
	before(() => { process.env.ANTHROPIC_API_KEY = "test-key"; });
	afterEach(() => {
		__setAnthropicFetchForTests();
		__setRuntimeContentDriverForTests();
		__setBundledPagesForTests();
	});
	after(() => {
		if (originalApiKey === undefined) Reflect.deleteProperty(process.env, "ANTHROPIC_API_KEY");
		else process.env.ANTHROPIC_API_KEY = originalApiKey;
	});

	describe("resolvePageSlugFromPath", () => {
		it("maps a mounted route to its slug", () => {
			assert.equal(resolvePageSlugFromPath("/giving"), "giving");
			assert.equal(resolvePageSlugFromPath("/giving/"), "giving");
			assert.equal(resolvePageSlugFromPath("/giving?edit"), "giving");
		});
		it("maps a /p/<slug> route to its slug", () => {
			assert.equal(resolvePageSlugFromPath("/p/welcome"), "welcome");
		});
		it("rejects a path with no Page Builder document", () => {
			assert.equal(resolvePageSlugFromPath("/about"), null);
			assert.equal(resolvePageSlugFromPath("/p/../../etc"), null);
		});
	});

	describe("proposePageEdit — patch validation", () => {
		it("fences an AI response down to allowed block types and drops invented ones", async () => {
			__setAnthropicFetchForTests(tool({
				reply: "Added the extra section.",
				data: {
					root: { props: { title: "Giving" } },
					content: [
						{ type: "Prose", props: { title: "Ways to give" } },
						{ type: "NotARealBlock", props: { evil: true } },
					],
				},
			}) as any);
			const current = page("live", "Giving", [{ type: "Hero", props: { heading: "Give" } }]);
			const proposal = await proposePageEdit("add a section about ways to give", current, [], { path: "/giving" });
			assert.equal(proposal.needsDesign, false);
			assert.ok(proposal.data);
			assert.deepEqual(proposal.data!.content.map((block) => block.type), ["Prose"]);
		});

		it("surfaces needsDesign plainly instead of fabricating a document", async () => {
			__setAnthropicFetchForTests(tool({
				reply: "That needs a brand-new interactive block I don't have — I'd need a developer to build it.",
				needsDesign: true,
			}) as any);
			const current = page("live", "Giving");
			const proposal = await proposePageEdit("add a live donation thermometer widget", current, [], {});
			assert.equal(proposal.needsDesign, true);
			assert.equal(proposal.data, null);
			assert.match(proposal.reply, /developer|design|build/i);
		});

		it("treats a tool response with no document the same as needsDesign", async () => {
			__setAnthropicFetchForTests(tool({ reply: "Could you say which section you mean?" }) as any);
			const proposal = await proposePageEdit("change it", page("live", "Giving"), [], {});
			assert.equal(proposal.data, null);
		});
	});

	describe("diffPageBlocks — before/after preview", () => {
		it("describes added, removed, changed, and moved blocks, plus title changes", () => {
			const before = page("live", "Giving", [
				{ type: "Hero", props: { id: "hero-1", heading: "Give generously" } },
				{ type: "Quote", props: { id: "quote-1", text: "Cheerful givers" } },
				{ type: "Prose", props: { id: "prose-1", title: "Ways to give" } },
			]);
			const after = page("live", "Giving Online", [
				{ type: "Prose", props: { id: "prose-1", title: "Ways to give" } },
				{ type: "Hero", props: { id: "hero-1", heading: "Give generously online" } },
				{ type: "Cards", props: { id: "cards-1", title: "Methods", cards: [{ title: "Text-to-give" }] } },
			]);

			const edits = diffPageBlocks(before, after);
			const byPath = new Map(edits.map((edit) => [edit.path, edit]));

			assert.equal(byPath.get("Page title")?.to, "Giving Online");
			assert.ok(byPath.get("Hero (block 2)"), "changed block is reported by its new position");
			assert.equal(byPath.get("Hero (block 2)")?.from, summarizeBlock({ type: "Hero", props: { heading: "Give generously" } }));
			assert.ok([...byPath.keys()].some((k) => k.startsWith("Added block")), "new Cards block reported as added");
			assert.ok([...byPath.keys()].some((k) => k.startsWith("Removed block")), "dropped Quote block reported as removed");
			assert.ok(byPath.get("Prose moved"), "unchanged Prose block reported as moved, not changed");
			assert.equal(byPath.get("Prose moved")?.from, "position 3");
			assert.equal(byPath.get("Prose moved")?.to, "position 1");
		});

		it("reports nothing when the document is unchanged", () => {
			const data = page("live", "Giving", [{ type: "Hero", props: { id: "hero-1", heading: "Give" } }]);
			assert.deepEqual(diffPageBlocks(data, sanitizeData(JSON.parse(JSON.stringify(data)))), []);
		});
	});

	describe("chat.ts routes Page Builder pages to the full-page brain", () => {
		it("returns a page-kind proposal with a real diff for a mounted Page Builder page", async () => {
			__setRuntimeContentDriverForTests(memoryBlob() as any);
			__setBundledPagesForTests({});
			await writePage("giving", page("live", "Giving", [{ type: "Hero", props: { id: "hero-1", heading: "Give" } }]), undefined, "seed", locals);
			__setAnthropicFetchForTests(tool({
				reply: "Updated the heading.",
				data: { root: { props: { title: "Giving" } }, content: [{ type: "Hero", props: { id: "hero-1", heading: "Give generously" } }] },
			}) as any);
			const cookies = await authedCookies();
			const res = await studioPost("../src/pages/api/studio/chat.ts", { message: "change the heading to Give generously", path: "/giving", page: "giving" }, cookies);
			assert.equal(res.status, 200);
			assert.equal(res.body.kind, "page");
			assert.equal(res.body.slug, "giving");
			assert.equal(typeof res.body.version, "string");
			assert.ok(res.body.edits.length > 0);
			assert.equal(res.body.edits[0].to, summarizeBlock({ type: "Hero", props: { heading: "Give generously" } }));
		});

		it("falls back to the fenced site.json brain for a page with no Page Builder document", async () => {
			__setRuntimeContentDriverForTests(memoryBlob() as any);
			__setAnthropicFetchForTests(tool({ reply: "Not sure which field.", edits: [] }) as any);
			const cookies = await authedCookies();
			const res = await studioPost("../src/pages/api/studio/chat.ts", { message: "change something", path: "/about", page: "about" }, cookies);
			assert.equal(res.status, 200);
			assert.notEqual(res.body.kind, "page");
		});

		it("requires auth", async () => {
			const res = await studioPost("../src/pages/api/studio/chat.ts", { message: "hi", path: "/giving" }, { get: () => undefined } as any);
			assert.equal(res.status, 401);
		});
	});

	describe("page-apply.ts — the versioned publish path", () => {
		it("saves the draft then publishes it live, and rejects a stale version", async () => {
			__setRuntimeContentDriverForTests(memoryBlob() as any);
			__setBundledPagesForTests({});
			const cookies = await authedCookies();
			const created = await writePage("giving", page("live", "Giving", [{ type: "Hero", props: { id: "hero-1", heading: "Give" } }]), undefined, "seed", locals);
			const draft = await readDraftPageState("giving", locals);
			assert.ok(draft);

			const proposed = sanitizeData({ root: { props: { title: "Giving" } }, content: [{ type: "Hero", props: { id: "hero-1", heading: "Give generously" } }] });
			const applied = await studioPost("../src/pages/api/studio/page-apply.ts", { slug: "giving", data: proposed, version: draft!.version }, cookies);
			assert.equal(applied.status, 200);
			assert.equal(applied.body.ok, true);
			assert.equal((await readPage("giving", locals))?.content[0].props.heading, "Give generously");
			assert.equal((await readPage("giving", locals))?.status, "live");

			const stale = await studioPost("../src/pages/api/studio/page-apply.ts", { slug: "giving", data: proposed, version: draft!.version }, cookies);
			assert.equal(stale.status, 409);
			void created;
		});

		it("rejects an unauthenticated request, and a request with no data", async () => {
			__setRuntimeContentDriverForTests(memoryBlob() as any);
			const cookies = await authedCookies();
			const noAuth = await studioPost("../src/pages/api/studio/page-apply.ts", { slug: "giving", data: {}, version: "seed" }, { get: () => undefined } as any);
			assert.equal(noAuth.status, 401);
			const noData = await studioPost("../src/pages/api/studio/page-apply.ts", { slug: "giving" }, cookies);
			assert.equal(noData.status, 400);
			const noVersion = await studioPost("../src/pages/api/studio/page-apply.ts", { slug: "giving", data: { content: [] } }, cookies);
			assert.equal(noVersion.status, 409);
		});

		it("strips a disallowed block type even if it somehow reaches the endpoint directly", async () => {
			__setRuntimeContentDriverForTests(memoryBlob() as any);
			__setBundledPagesForTests({});
			const cookies = await authedCookies();
			await writePage("giving", page("live", "Giving"), undefined, "seed", locals);
			const draft = await readDraftPageState("giving", locals);
			const malicious = { root: { props: { title: "Giving" } }, content: [{ type: "ScriptInjection", props: { src: "javascript:alert(1)" } }] };
			const res = await studioPost("../src/pages/api/studio/page-apply.ts", { slug: "giving", data: malicious, version: draft!.version }, cookies);
			assert.equal(res.status, 200);
			assert.deepEqual((await readPage("giving", locals))?.content, []);
		});
	});

	describe("writeDraftPage / ContentConflict still guard concurrent edits", () => {
		it("rejects a stale draft save the same way the visual builder does", async () => {
			__setRuntimeContentDriverForTests(memoryBlob() as any);
			__setBundledPagesForTests({});
			await writePage("giving", page("live", "Giving"), undefined, "seed", locals);
			const first = await writeDraftPage("giving", page("live", "One"), "seed", locals);
			await assert.rejects(() => writeDraftPage("giving", page("live", "Two"), "seed", locals), ContentConflict);
			void first;
		});
	});
});
