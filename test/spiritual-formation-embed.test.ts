import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import nextStepsPage from "../content/pages/next-steps.json" with { type: "json" };

// Jon asked that the "Start Growth Track" button on /links/next-steps open
// /spiritual-formation inline in the existing tap panel, the same way Give,
// the Church Map prayer card, and the Connect card already do. Unlike those,
// /spiritual-formation is a full content page rendered through the shared
// Interior layout, so the embed mechanism lives in Interior.astro itself
// (gated on ?embed=1) rather than in a per-page *Embed.astro copy.

function growthTrackButton() {
	const block = nextStepsPage.content.find((c: any) => c.type === "TapButtons");
	return (block!.props.links as any[]).find((l) => l.label === "Start Growth Track");
}

test("the Growth Track button is flagged for inline embedding", () => {
	const button = growthTrackButton();
	assert.ok(button);
	assert.equal(button.embed, "inline");
	assert.equal(button.embedSrc, "/spiritual-formation?embed=1");
	assert.ok(button.embedHeight);
	// No-JS visitors still land on the real, full page — never the bare
	// embed=1 variant.
	assert.equal(button.href, "/spiritual-formation");
});

test("Interior.astro hides site chrome only when ?embed=1 is present", () => {
	const src = readFileSync(new URL("../src/layouts/Interior.astro", import.meta.url), "utf8");
	assert.match(src, /searchParams\.get\("embed"\) === "1"/);
	// Header, footer and Studio dock are each conditioned on NOT being embed.
	assert.match(src, /\{!isEmbed && <SiteHeader/);
	assert.match(src, /\{!isEmbed && \(\s*<footer/);
	assert.match(src, /\{!isEmbed && <StudioDock/);
	// The embed style block is only emitted in embed mode, and makes the page
	// transparent so it matches the dark panel it sits inside.
	assert.match(src, /isEmbed && \(\s*<style>/);
	assert.match(src, /background: transparent/);
});

test("spiritual-formation.astro keeps its one inner site-page link from navigating the embed frame away", () => {
	const src = readFileSync(new URL("../src/pages/spiritual-formation.astro", import.meta.url), "utf8");
	assert.match(src, /searchParams\.get\("embed"\) === "1"/);
	assert.match(src, /href="\/ministries#ours" target=\{isEmbed \? "_blank" : undefined\}/);
});
