import assert from "node:assert/strict";
import test from "node:test";
import tapPage from "../content/pages/tap.json" with { type: "json" };
import linksPage from "../content/pages/links.json" with { type: "json" };
import nextStepsPage from "../content/pages/next-steps.json" with { type: "json" };

// /links/pray (the "tap" slug) got a new heading, lede, and scripture pull
// quote (Jon, 2026-09-26). The old "Start here." wording must be gone
// everywhere on the page, and the quote must not leak onto the sibling
// TapButtons pages.

function tapButtonsProps(page: any) {
	const block = page.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	return block!.props;
}

test("/links/pray has the new heading and no trace of the old wording", () => {
	assert.equal(tapPage.root.props.title, "Unite the Church. Reveal Jesus to the city.");
	const props = tapButtonsProps(tapPage);
	assert.equal(props.heading, "Unite the Church. Reveal Jesus to the city.");

	const serialized = JSON.stringify(tapPage);
	assert.ok(!serialized.includes("Start here"), "the old heading must not appear anywhere on the page");
});

test("/links/pray has the new lede", () => {
	const props = tapButtonsProps(tapPage);
	assert.equal(props.lede, "Pray for a neighbor, encourage another congregation, and go with us across Grand Rapids.");
	assert.equal(
		tapPage.root.props.description,
		"Pray for a neighbor, encourage another congregation, and go with us across Grand Rapids.",
	);
});

test("/links/pray has the scripture pull quote and its attribution", () => {
	const props = tapButtonsProps(tapPage);
	assert.equal(props.quote, "That they may be one, just as We are one.");
	assert.equal(props.quoteCite, "Jesus, John 17:22");
});

test("/links and /links/next-steps carry no quote", () => {
	const linksProps = tapButtonsProps(linksPage);
	const nextStepsProps = tapButtonsProps(nextStepsPage);
	assert.ok(!linksProps.quote, "/links should not have a quote");
	assert.ok(!nextStepsProps.quote, "/links/next-steps should not have a quote");
});

test("/links/pray leads with Strengthen the Church, and the gold highlight moved with it", () => {
	const props = tapButtonsProps(tapPage);
	const links: any[] = props.links;
	assert.equal(links[0].label, "Strengthen the Church");
	assert.equal(links[0].feature, "yes");
	const pray = links.find((l: any) => l.label === "Pray for a Person");
	assert.ok(pray, "expected the Pray for a Person button to still exist");
	assert.equal(pray.feature, "no");

	// Only one button is featured.
	assert.equal(links.filter((l: any) => l.feature === "yes").length, 1);
});
