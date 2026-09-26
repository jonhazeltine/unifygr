import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// /spiritual-formation is a full content page rendered through the shared
// Interior layout, so it carries Interior's embed mechanism (gated on
// ?embed=1) for free, even though no button on the live site currently
// embeds it inline — the Grow page's "Growth Track" button now opens The
// Formation App directly in a preview panel instead (see
// links-preview-panels.test.ts and next-steps.json), since Jon confirmed
// Growth Track's modules live in the app rather than on this page. Interior
// keeps the ?embed=1 support anyway: any other page embedded through it (for
// example /connect) shares this exact mechanism, and a future button could
// still point at /spiritual-formation?embed=1 again.

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
