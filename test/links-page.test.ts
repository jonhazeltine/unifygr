import assert from "node:assert/strict";
import test from "node:test";
import { MOUNTED, BARE } from "../src/lib/studio/pages";
import linksPage from "../content/pages/links.json" with { type: "json" };

// The /links page replaces the Clearstream microsite (newlifegr.cls.co) as
// our own "link in bio" page. It reuses the same TapButtons block as /tap and
// /next-steps, so every button on it comes from content/pages/links.json —
// this test is the guard that the full Clearstream link inventory made it in
// and stays in, in its original order, with nothing invented or dropped.
const CLEARSTREAM_LINKS = [
	{ label: "I'm New", href: "https://newlifegr.com/next-steps" },
	{ label: "Pray", href: "https://newlifegr.com/tap" },
	{ label: "The Formation App", href: "https://theformation.app/?community=0LY0R#/auth?community=0LY0R" },
	{ label: "Give", href: "https://app.securegive.com/NewLifeGR/new-life/donate/category" },
];

const CLEARSTREAM_SOCIALS = [
	{ label: "Website", href: "https://newlifegr.com" },
	{ label: "YouTube", href: "https://www.youtube.com/@newlifegrandrapids2177/streams" },
	{ label: "Facebook", href: "https://www.facebook.com/NewLifeGr/mentions" },
	{ label: "Instagram", href: "https://www.instagram.com/newlifegr/" },
];

test("/links is mounted as a bare, live TapButtons builder page", () => {
	assert.equal(MOUNTED["links"], "/links");
	assert.ok(BARE.has("links"));
	assert.equal(linksPage.status, "live");
});

test("/links carries a title and description for meta/OG tags", () => {
	assert.ok(linksPage.root.props.title);
	assert.ok(linksPage.root.props.description);
});

test("/links renders every Clearstream item link, in the original order", () => {
	const block = linksPage.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	const hrefs: string[] = block!.props.links.map((l: any) => l.href);
	const labels: string[] = block!.props.links.map((l: any) => l.label);

	let cursor = -1;
	for (const expected of CLEARSTREAM_LINKS) {
		const idx = hrefs.indexOf(expected.href);
		assert.notEqual(idx, -1, `missing Clearstream link: ${expected.label} (${expected.href})`);
		assert.equal(labels[idx], expected.label);
		assert.ok(idx > cursor, `link "${expected.label}" is out of its original Clearstream order`);
		cursor = idx;
	}
});

test("/links also carries every Clearstream social link", () => {
	const block = linksPage.content.find((c: any) => c.type === "TapButtons");
	const hrefs: string[] = block!.props.links.map((l: any) => l.href);
	for (const social of CLEARSTREAM_SOCIALS) {
		assert.ok(hrefs.includes(social.href), `missing Clearstream social link: ${social.label} (${social.href})`);
	}
});
