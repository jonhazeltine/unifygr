import assert from "node:assert/strict";
import test from "node:test";
import tapPage from "../content/pages/tap.json" with { type: "json" };

// The /links/pray page ("tap" slug) renamed "Pray for The Church" to
// "Strengthen the Church" and made it open The Church Map's prayer page
// inline (like Give on /links) instead of navigating away.
test("/links/pray has the Strengthen the Church button with its new copy", () => {
	const block = tapPage.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	const links: any[] = block!.props.links;
	const button = links.find((l: any) => l.label === "Strengthen the Church");
	assert.ok(button, "expected a Strengthen the Church button");
	assert.equal(
		button.blurb,
		"Share an encouraging word, a scripture or a prayer with another congregation in Grand Rapids.",
	);
	assert.equal(button.href, "https://thechurchmap.com/grandrapids/pray");

	// No button on this page carries the old label any more.
	assert.ok(!links.some((l: any) => l.label === "Pray for The Church"));
});

test("Strengthen the Church opens inline instead of navigating away", () => {
	const block = tapPage.content.find((c: any) => c.type === "TapButtons");
	const links: any[] = block!.props.links;
	const button = links.find((l: any) => l.label === "Strengthen the Church");
	assert.ok(button.embed, "expected the button to be flagged for inline embedding");
	assert.equal(button.embed, "inline");
	// The href stays a real, direct link so it still works with no JavaScript.
	assert.ok(button.href.startsWith("https://thechurchmap.com/"));

	// Only this button on the page is flagged inline.
	for (const link of links) {
		if (link.label === "Strengthen the Church") continue;
		assert.ok(!link.embed, `only Strengthen the Church should be flagged inline, not "${link.label}"`);
	}
});
