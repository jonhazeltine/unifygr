import assert from "node:assert/strict";
import test from "node:test";
import { MOUNTED, BARE } from "../src/lib/studio/pages";
import tapPage from "../content/pages/tap.json" with { type: "json" };
import nextStepsPage from "../content/pages/next-steps.json" with { type: "json" };
import linksPage from "../content/pages/links.json" with { type: "json" };
import goLinksPage from "../content/pages/go-links.json" with { type: "json" };

// /tap and /next-steps were renamed to live under /links so the phone-first
// "bare" pages read as one family. The "tap" slug now mounts at /links/pray
// (the prayer page); a new "go-links" slug mounts at /links/go. Studio slugs
// are unchanged for existing pages — only where they're mounted moved — so
// content saved against those slugs keeps rendering at the new URL
// (see src/lib/studio/page-routes.ts and pages.ts, which key everything by
// slug, never by mounted path).
test("the tap, next-steps and go-links slugs mount under /links", () => {
	assert.equal(MOUNTED["tap"], "/links/pray");
	assert.equal(MOUNTED["next-steps"], "/links/grow");
	assert.equal(MOUNTED["links"], "/links");
	assert.equal(MOUNTED["new"], "/links/new");
	assert.equal(MOUNTED["go-links"], "/links/go");
	assert.ok(BARE.has("tap"));
	assert.ok(BARE.has("next-steps"));
	assert.ok(BARE.has("links"));
	assert.ok(BARE.has("new"));
	assert.ok(BARE.has("go-links"));
});

function tapButtonsBlock(page: any) {
	const block = page.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	return block;
}

test("/links/pray (slug tap), /links/next-steps (slug next-steps) and /links/go (slug go-links) each carry a back link to /links", () => {
	for (const page of [tapPage, nextStepsPage, goLinksPage]) {
		const block = tapButtonsBlock(page);
		assert.equal(block.props.homeHref, "/links");
		assert.equal(block.props.homeLabel, "Links");
		assert.equal(block.props.homeIcon, "back", "expected the back-arrow icon variant, not the house icon");
	}
});

test("/links itself keeps its house-icon link out to newlifegr.com, not a back link", () => {
	const block = tapButtonsBlock(linksPage);
	assert.equal(block.props.homeHref, "https://newlifegr.com");
	assert.notEqual(block.props.homeIcon, "back");
});
