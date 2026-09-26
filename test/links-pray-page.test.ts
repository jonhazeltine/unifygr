import assert from "node:assert/strict";
import test from "node:test";
import { MOUNTED, BARE } from "../src/lib/studio/pages";
import tapPage from "../content/pages/tap.json" with { type: "json" };

// /links/pray (slug "tap") is the prayer page. It keeps its heading, lede
// and John 17:22 quote, and now carries ONLY "Strengthen the Church" (gold)
// and "Pray for a Person" — "Go with an Ambassador Team", "The Church Map"
// and "Join a GO Team" moved to the new /links/go page (slug "go-links")
// (Jon's I'm New / Grow / Pray / Go / Give restructure, 2026-09-26).

function tapButtonsBlock() {
	const block = tapPage.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	return block;
}

test("the tap slug mounts at /links/pray, bare, and is live", () => {
	assert.equal(MOUNTED["tap"], "/links/pray");
	assert.ok(BARE.has("tap"));
	assert.equal(tapPage.status, "live");
});

test("/links/pray has exactly two buttons, in order: Strengthen the Church, Pray for a Person", () => {
	const block = tapButtonsBlock();
	const links: any[] = block.props.links;
	assert.deepEqual(
		links.map((l: any) => l.label),
		["Strengthen the Church", "Pray for a Person"],
	);
});

test("Strengthen the Church is gold and Pray for a Person is not", () => {
	const block = tapButtonsBlock();
	const links: any[] = block.props.links;
	assert.equal(links.find((l: any) => l.label === "Strengthen the Church").feature, "no");
	assert.equal(links.find((l: any) => l.label === "Pray for a Person").feature, "no");
});

test("both buttons keep their inline settings intact", () => {
	const block = tapButtonsBlock();
	const links: any[] = block.props.links;

	const strengthen = links.find((l: any) => l.label === "Strengthen the Church");
	assert.equal(strengthen.embed, "inline");
	assert.equal(strengthen.href, "https://thechurchmap.com/grandrapids/pray?embed=1");

	const pray = links.find((l: any) => l.label === "Pray for a Person");
	assert.equal(pray.embed, "inline");
	assert.equal(pray.href, "https://thechurchmap.com/pray");
	assert.equal(pray.embedSrc, "https://thechurchmap.com/pray?embed=1");
});

test("/links/pray still carries its heading, lede and John 17:22 quote", () => {
	const block = tapButtonsBlock();
	assert.equal(block.props.heading, "Unite the Church. Reveal Jesus to the city.");
	assert.equal(
		block.props.lede,
		"Pray for a neighbor, encourage another congregation, and strengthen Christ's Body throughout the city.",
	);
	assert.equal(block.props.quote, "That they may be one, just as We are one.");
	assert.equal(block.props.quoteCite, "Jesus, John 17:22");
});

test("no other buttons remain on /links/pray", () => {
	const block = tapButtonsBlock();
	const labels: string[] = block.props.links.map((l: any) => l.label);
	for (const moved of ["Go with an Ambassador Team", "The Church Map", "Join a GO Team"]) {
		assert.ok(!labels.includes(moved), `expected "${moved}" to have moved off /links/pray`);
	}
});
