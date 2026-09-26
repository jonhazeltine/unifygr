import assert from "node:assert/strict";
import test from "node:test";
import { MOUNTED, BARE } from "../src/lib/studio/pages";
import newPage from "../content/pages/new.json" with { type: "json" };

// /links/new (slug "new") is the first-time visitor's landing page after
// tapping "I'm New" on /links — everything for their first few Sundays.
// Kids is deliberately left out until the Formation kids-lessons link is
// confirmed (Jon, 2026-09-26).

function tapButtonsBlock() {
	const block = newPage.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	return block;
}

test("the new slug mounts at /links/new, bare, and is live", () => {
	assert.equal(MOUNTED["new"], "/links/new");
	assert.ok(BARE.has("new"));
	assert.equal(newPage.status, "live");
});

test("/links/new carries a back link to /links, matching the other sub pages", () => {
	const block = tapButtonsBlock();
	assert.equal(block.props.homeHref, "/links");
	assert.equal(block.props.homeLabel, "Links");
	assert.equal(block.props.homeIcon, "back");
});

test("/links/new has the 'Welcome home.' heading and lede", () => {
	assert.equal(newPage.root.props.title, "Welcome home.");
	const block = tapButtonsBlock();
	assert.equal(block.props.heading, "Welcome home.");
	assert.equal(block.props.lede, "Everything you need for your first few Sundays at New Life.");
});

test("/links/new has exactly the five expected buttons, in order", () => {
	const block = tapButtonsBlock();
	const labels: string[] = block.props.links.map((l: any) => l.label);
	assert.deepEqual(labels, ["Welcome to New Life", "Plan your Sunday", "Kids", "Calendar", "Let us know you're here"]);
});

test("Kids previews then opens the public New Life page in The Formation App", () => {
	const block = tapButtonsBlock();
	const link = block.props.links.find((l: any) => l.label === "Kids");
	assert.ok(link);
	assert.equal(link.href, "https://theformation.app/c/newlifegr");
	assert.ok(link.preview);
	assert.equal(link.previewAction, "Open kids lessons");
});

test("Plan your Sunday links to /sunday", () => {
	const block = tapButtonsBlock();
	const link = block.props.links.find((l: any) => l.label === "Plan your Sunday");
	assert.ok(link);
	assert.equal(link.href, "/sunday");
});

test("Calendar links to /ministries/calendar", () => {
	const block = tapButtonsBlock();
	const link = block.props.links.find((l: any) => l.label === "Calendar");
	assert.ok(link);
	assert.equal(link.href, "/ministries/calendar");
});

test("Let us know you're here opens the Connect card inline with the I'm new interest id", () => {
	const block = tapButtonsBlock();
	const link = block.props.links.find((l: any) => l.label === "Let us know you're here");
	assert.ok(link);
	assert.equal(link.embed, "inline");
	assert.equal(link.embedSrc, "/connect?interest=first-time&from=links+new&embed=1");
	// No-JS fallback stays the full page, no embed=1.
	assert.equal(link.href, "/connect?interest=first-time&from=links+new");
});
