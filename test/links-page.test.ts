import assert from "node:assert/strict";
import test from "node:test";
import { MOUNTED, BARE } from "../src/lib/studio/pages";
import linksPage from "../content/pages/links.json" with { type: "json" };

// The /links page replaces the Clearstream microsite (newlifegr.cls.co) as
// our own "link in bio" page. It reuses the same TapButtons block as /tap and
// /next-steps, so every button on it comes from content/pages/links.json —
// this test is the guard that the full Clearstream link inventory made it in
// and stays in, in its original order, with nothing invented or dropped.
const BIG_BUTTONS = [
	{ label: "I'm New", href: "/links/next-steps" },
	{ label: "Welcome to New Life", href: "https://theformation.app/m/welcome-to-new-life" },
	{ label: "Pray", href: "/links/pray" },
	{ label: "The Formation App", href: "https://theformation.app/?community=0LY0R#/auth?community=0LY0R" },
	{
		label: "Give",
		href: "https://app.securegive.com/NewLifeGR/new-life/static/widget/donate?cats=14982&amts=false",
		embed: "securegive",
	},
];

const SOCIALS = [
	{ platform: "youtube", href: "https://www.youtube.com/@newlifegrandrapids2177/streams" },
	{ platform: "facebook", href: "https://www.facebook.com/NewLifeGr/mentions" },
	{ platform: "instagram", href: "https://www.instagram.com/newlifegr/" },
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

test("/links has exactly five big buttons, in order, with no description text", () => {
	const block = linksPage.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	const links: any[] = block!.props.links;
	assert.equal(links.length, 5, "expected exactly five big buttons");

	links.forEach((link, i) => {
		assert.equal(link.label, BIG_BUTTONS[i].label);
		assert.equal(link.href, BIG_BUTTONS[i].href);
		assert.equal(link.blurb, "", `expected no blurb/description text under "${link.label}"`);
	});
});

test("/links opens Give inline (SecureGive embedded) instead of navigating away", () => {
	const block = linksPage.content.find((c: any) => c.type === "TapButtons");
	const links: any[] = block!.props.links;
	const give = links.find((l: any) => l.label === "Give");
	assert.ok(give, "expected a Give button");
	assert.equal(give.embed, "securegive", "the Give button should be flagged to embed inline");
	assert.ok(give.href.startsWith("https://app.securegive.com/"), "the href stays a real SecureGive link for no-JS visitors");

	// No other button on /links is flagged inline — Give is the one exception.
	for (const link of links) {
		if (link.label === "Give") continue;
		assert.ok(!link.embed, `only Give should be flagged inline, not "${link.label}"`);
	}
});

test("/links has a Welcome to New Life button directly below I'm New, external and not inline", () => {
	const block = linksPage.content.find((c: any) => c.type === "TapButtons");
	const links: any[] = block!.props.links;
	const newIndex = links.findIndex((l: any) => l.label === "I'm New");
	const welcomeIndex = links.findIndex((l: any) => l.label === "Welcome to New Life");
	assert.ok(welcomeIndex >= 0, "expected a Welcome to New Life button");
	assert.equal(welcomeIndex, newIndex + 1, "Welcome to New Life should sit directly below I'm New");

	const welcome = links[welcomeIndex];
	assert.equal(welcome.href, "https://theformation.app/m/welcome-to-new-life");
	assert.equal(welcome.blurb, "");
	assert.ok(!welcome.embed, "Welcome to New Life should not be an inline embed");
	assert.equal(welcome.feature, "no", "only I'm New keeps the gold highlight");

	const imNew = links[newIndex];
	assert.equal(imNew.feature, "yes", "I'm New should keep its gold highlight");
});

test("/links no longer has a Website big button", () => {
	const block = linksPage.content.find((c: any) => c.type === "TapButtons");
	const labels: string[] = block!.props.links.map((l: any) => l.label);
	assert.ok(!labels.includes("Website"), "the Website big button should be removed");
});

test("/links carries the three social icons, with the correct hrefs, separate from the big buttons", () => {
	const block = linksPage.content.find((c: any) => c.type === "TapButtons");
	const socials: any[] = block!.props.socials;
	assert.ok(Array.isArray(socials) && socials.length === 3, "expected three social entries");
	for (const expected of SOCIALS) {
		const found = socials.find((s: any) => s.platform === expected.platform);
		assert.ok(found, `missing social icon: ${expected.platform}`);
		assert.equal(found.href, expected.href);
	}

	// Socials render above the "I'm New" button (which is the first big
	// button), never mixed into the big-button list.
	const links: any[] = block!.props.links;
	const socialHrefs = socials.map((s: any) => s.href);
	for (const link of links) {
		assert.ok(!socialHrefs.includes(link.href), "a social link leaked into the big-button list");
	}
	assert.equal(links[0].label, "I'm New");
});

test("/links has a top-left home link pointing at newlifegr.com", () => {
	const block = linksPage.content.find((c: any) => c.type === "TapButtons");
	assert.equal(block!.props.homeHref, "https://newlifegr.com");
	assert.ok(block!.props.homeLabel, "expected a label for the top-left home link");
});
