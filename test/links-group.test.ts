import assert from "node:assert/strict";
import test from "node:test";
import { MOUNTED, BARE } from "../src/lib/studio/pages";
import tapPage from "../content/pages/tap.json" with { type: "json" };
import nextStepsPage from "../content/pages/next-steps.json" with { type: "json" };
import linksPage from "../content/pages/links.json" with { type: "json" };

// /tap and /next-steps were renamed to live under /links so the three
// phone-first "bare" pages read as one family. Their Studio slugs ("tap",
// "next-steps") are unchanged — only where they're mounted moved — so
// content saved against those slugs keeps rendering at the new URL
// (see src/lib/studio/page-routes.ts and pages.ts, which key everything by
// slug, never by mounted path).
test("the tap and next-steps slugs now mount under /links", () => {
	assert.equal(MOUNTED["tap"], "/links/pray");
	assert.equal(MOUNTED["next-steps"], "/links/next-steps");
	assert.equal(MOUNTED["links"], "/links");
	assert.ok(BARE.has("tap"));
	assert.ok(BARE.has("next-steps"));
	assert.ok(BARE.has("links"));
});

function tapButtonsBlock(page: any) {
	const block = page.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	return block;
}

test("/links/pray (slug tap) and /links/next-steps (slug next-steps) each carry a back link to /links", () => {
	for (const page of [tapPage, nextStepsPage]) {
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
