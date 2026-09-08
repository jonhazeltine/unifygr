import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	allFamiliesIncludingSpecialised,
	classifyFamilies,
	entries as seedEntries,
	type Entry,
} from "../src/data/ministries.ts";
import { answersForChurch, serviceForChurch } from "../src/data/sunday.ts";
import {
	__setRuntimeContentDriverForTests,
	publish,
} from "../src/lib/studio/runtime-content.ts";

type MemoryEntry = { body: string; etag: string };

function memoryBlob() {
	const entries = new Map<string, MemoryEntry>();
	let sequence = 0;
	return {
		get: async (key: string) => {
			const entry = entries.get(key);
			return entry ? { statusCode: 200 as const, stream: new Response(entry.body).body!, blob: { etag: entry.etag } } : null;
		},
		put: async (key: string, body: any, options: any) => {
			const current = entries.get(key);
			if ((current && options.ifMatch !== current.etag) || (!current && options.ifMatch) || (current && !options.ifMatch && !options.allowOverwrite)) {
				throw Object.assign(new Error("precondition failed"), { name: "BlobPreconditionFailedError" });
			}
			entries.set(key, { body: await new Response(body).text(), etag: `e${++sequence}` });
			return {};
		},
		list: async ({ prefix }: { prefix: string }) => ({
			blobs: [...entries.keys()].filter((pathname) => pathname.startsWith(prefix)).map((pathname) => ({ pathname })),
		}),
	};
}

const locals = { runtime: { env: { BLOB_READ_WRITE_TOKEN: "test" } } };

test("live visit fields feed the header, layouts, home, Sunday copy, and metadata", async () => {
	const church = {
		serviceTime: "Saturdays at 6pm",
		address: { street: "123 Runtime Ave", city: "Ada", state: "MI", zip: "49301" },
	};
	const visit = serviceForChurch(church);
	assert.equal(visit.shortWhen, "Saturdays at 6pm");
	assert.equal(visit.street, "123 Runtime Ave");
	assert.match(answersForChurch(church).find((answer) => answer.q === "Where is it?")!.a, /123 Runtime Ave, Ada, MI 49301/);

	const files = [
		"src/components/SiteHeader.astro",
		"src/layouts/Site.astro",
		"src/layouts/Interior.astro",
		"src/pages/index.astro",
		"src/pages/sunday.astro",
	];
	for (const file of files) {
		const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
		assert.match(source, /runtimeSite\(Astro\.locals\)/, file);
		assert.match(source, /serviceForChurch\(church\)/, file);
	}
	for (const file of ["src/layouts/Site.astro", "src/layouts/Interior.astro"]) {
		const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
		assert.match(source, /<SiteHeader[^>]*church=\{church\}/, file);
	}
	const home = await readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8");
	assert.match(home, /title=\{`\$\{church\.name\} — \$\{church\.serviceTime\}`\}/);
	assert.match(home, /church\.address\.street/);
	const sunday = await readFile(new URL("../src/pages/sunday.astro", import.meta.url), "utf8");
	assert.match(sunday, /church\.serviceTime/);
	assert.match(sunday, /church\.address\.street/);
});

test("family browse classification follows a zero-to-one runtime offering transition", () => {
	const family = allFamiliesIncludingSpecialised.find((candidate) => candidate.slug === "health")!;
	const categorySlugs = new Set(family.categories.map((category) => category.slug));
	const withoutHealth = seedEntries.filter((entry) => !entry.categories.some((category) => categorySlugs.has(category)));

	const restored: Entry = {
		slug: "runtime-health-offering",
		name: "Runtime Health Offering",
		house: "in",
		tier: "core",
		categories: [family.categories[0].slug],
		summary: "Synthetic test offering",
		status: "live",
	};
	assert(classifyFamilies([...withoutHealth, { ...restored, listed: false }]).specialisedFamilies.has(family.slug));
	const oneOffering = classifyFamilies([...withoutHealth, { ...restored, listed: true }]);
	assert(!oneOffering.specialisedFamilies.has(family.slug));
	assert(oneOffering.families.some((candidate) => candidate.slug === family.slug));

	const baseline = classifyFamilies(seedEntries);
	assert.equal(baseline.families.length, 15);
	assert(baseline.specialisedFamilies.has("mental-health"));
});

test("runtime directory switches and Builder status drive the sitemap route", async () => {
	__setRuntimeContentDriverForTests(memoryBlob() as any);
	const entry = seedEntries.find((candidate) => candidate.listed !== false)!;
	const noDetails = seedEntries.find((candidate) => candidate.status === "no-details")!;
	try {
		const hidden = await publish(
			"partners/directory-overrides.json",
			{
				[entry.slug]: { listed: false },
			},
			{},
			"seed",
			locals,
		);
		const sitemap = await import("../src/pages/sitemap.xml.ts");
		let response = await sitemap.GET({ locals } as any);
		let xml = await response.text();
		assert(!xml.includes(`/ministry/${entry.slug}</loc>`));
		assert(!xml.includes(`/ministry/${noDetails.slug}</loc>`));
		assert(!xml.includes("/go</loc>"), "a draft mounted Builder route must stay out of the sitemap");

		await publish(
			"partners/directory-overrides.json",
			{
				[entry.slug]: { listed: true },
				[noDetails.slug]: { confirmed: true },
			},
			{},
			hidden.version,
			locals,
		);
		response = await sitemap.GET({ locals } as any);
		xml = await response.text();
		assert(xml.includes(`/ministry/${entry.slug}</loc>`));
		assert(xml.includes(`/ministry/${noDetails.slug}</loc>`));

		const { publicPaths } = await import("../src/lib/discovery.ts");
		const livePaths = publicPaths({ pillars: [], families: [], entries: [], pages: [{ path: "/go", status: "live" }] });
		assert(livePaths.includes("/go"));
	} finally {
		__setRuntimeContentDriverForTests();
	}
});

test("the public ministry detail route rejects hidden directory entries", async () => {
	const source = await readFile(new URL("../src/pages/ministry/[slug].astro", import.meta.url), "utf8");
	assert.match(source, /!entry \|\| !isListable\(entry as Entry\)/);
});

test("page AI receives Worker locals and applies a bounded provider timeout", async () => {
	const source = await readFile(new URL("../src/pages/api/studio/page-ai.ts", import.meta.url), "utf8");
	assert.match(source, /async \(\{ request, cookies, locals \}\)/);
	assert.match(source, /listSiteImages\(locals\)/);
	assert.match(source, /AbortSignal\.timeout\(30_000\)/);
});
