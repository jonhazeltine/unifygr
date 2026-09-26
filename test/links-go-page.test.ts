import assert from "node:assert/strict";
import test from "node:test";
import { MOUNTED, BARE } from "../src/lib/studio/pages";
import goLinksPage from "../content/pages/go-links.json" with { type: "json" };

// /links/go is now its own page, slug "go-links" (the old "tap" slug moved
// to /links/pray, and /go itself stays a separate, unrelated slug mounted
// at /go). It carries "Go with an Ambassador Team" (first, gold), "Join a
// GO Team" and "The Church Map" — copied exactly from the old /tap page —
// and no scripture quote (Jon's I'm New / Grow / Pray / Go / Give
// restructure, 2026-09-26).

function tapButtonsBlock() {
	const block = goLinksPage.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	return block;
}

test("the go-links slug mounts at /links/go, bare, and is live", () => {
	assert.equal(MOUNTED["go-links"], "/links/go");
	assert.ok(BARE.has("go-links"));
	assert.equal(goLinksPage.status, "live");
});

test("/links/go carries a back link to /links", () => {
	const block = tapButtonsBlock();
	assert.equal(block.props.homeHref, "/links");
	assert.equal(block.props.homeLabel, "Links");
	assert.equal(block.props.homeIcon, "back");
});

test("/links/go has the 'Go.' heading and lede, and no quote", () => {
	assert.equal(goLinksPage.root.props.title, "Go.");
	const block = tapButtonsBlock();
	assert.equal(block.props.heading, "Go.");
	assert.equal(block.props.lede, "Go with us to pray alongside other churches and serve across Grand Rapids.");
	assert.ok(!(block.props as any).quote, "/links/go should not have a quote");
});

test("/links/go has exactly three buttons, in order, with Go with an Ambassador Team first and gold", () => {
	const block = tapButtonsBlock();
	const links: any[] = block.props.links;
	assert.deepEqual(
		links.map((l: any) => l.label),
		["Go with an Ambassador Team", "Join a GO Team", "The Church Map"],
	);
	assert.equal(links[0].feature, "yes");
	for (const link of links.slice(1)) {
		assert.equal(link.feature, "no");
	}
});

test("Go with an Ambassador Team and Join a GO Team keep their inline Connect settings exactly", () => {
	const block = tapButtonsBlock();
	const links: any[] = block.props.links;

	const ambassador = links.find((l: any) => l.label === "Go with an Ambassador Team");
	assert.equal(ambassador.embed, "inline");
	assert.equal(ambassador.href, "/connect?interest=ambassador&from=tap+page");
	assert.equal(ambassador.embedSrc, "/connect?interest=ambassador&from=tap+page&embed=1");
	assert.equal(ambassador.embedHeight, "80vh");

	const goTeam = links.find((l: any) => l.label === "Join a GO Team");
	assert.equal(goTeam.embed, "inline");
	assert.equal(goTeam.href, "/connect?from=next+steps+page#teams");
	assert.equal(goTeam.embedSrc, "/connect?from=next+steps+page&embed=1#teams");
	assert.equal(goTeam.embedHeight, "80vh");
});

test("The Church Map keeps its plain link, not embedded", () => {
	const block = tapButtonsBlock();
	const churchMap = block.props.links.find((l: any) => l.label === "The Church Map");
	assert.ok(churchMap);
	assert.equal(churchMap.href, "https://thechurchmap.com/grandrapids");
	assert.ok(!churchMap.embed);
});
