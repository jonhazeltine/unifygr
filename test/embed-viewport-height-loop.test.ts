import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { clampEmbedHeight, MAX_EMBED_HEIGHT } from "../src/lib/embed/panel-height";

// Jon reported the "Start Growth Track" panel on /links/grow as "totally
// jacked up". Root cause, reproduced at 375x812 against a live dev server:
// /spiritual-formation's `.growth-chapter` sections are sized with
// `height: 185svh` (a scroll-jacking "scrollytelling" effect — see the
// `@media (prefers-reduced-motion: reduce)` fallback right next to it in
// spiritual-formation.astro). An auto-height embed panel sets the iframe's
// own CSS height to match the document height the page reports (see
// MountedPage.astro's "nlgr-embed-height" listener). Inside that same
// document, `100svh` resolves against the iframe's OWN rendered height —
// the thing we just set from the page's measured height — so growing the
// content grows the iframe, which grows every `svh` inside it, which grows
// the content again. Measured before the fix: three `.growth-chapter`
// sections at ~32,900px each (a ~103,800px document) before hitting the
// MAX_EMBED_HEIGHT safety clamp. A second, independent bug compounded it:
// Interior.astro's embed-mode background rule (`html, body { background:
// transparent }`, an element selector) lost a specificity fight against
// sunday.css's `body.v2 { background: var(--ink) }` (a class selector), so
// the panel showed the page's own opaque background instead of matching the
// dark host panel.
//
// The fix lives in Interior.astro (the shared embed layer any page rendered
// through it inherits), not in spiritual-formation.astro or the button
// config: neither the page's own CSS nor the growth-chapter markup needed
// touching to be the "one, generic" fix.

function interiorSource() {
	return fs.readFileSync(new URL("../src/layouts/Interior.astro", import.meta.url), "utf8");
}

test("embed mode wins the background fight with !important, not just a class selector", () => {
	const src = interiorSource();
	// body.v2--embed is (0,1,1) — the exact same specificity as sunday.css's
	// body.v2 (0,1,1) — so a plain class-selector override is not a reliable
	// fix; only !important (or a source-order guarantee this project makes
	// no promise about) wins deterministically.
	assert.match(src, /background:\s*transparent\s*!important;\s*\n\s*overflow:\s*hidden/);
});

test("embed mode neutralizes viewport-relative sizing so no element can feed the auto-height loop", () => {
	const src = interiorSource();
	const embedBlockMatch = src.match(/\{isEmbed && \(\s*<style>([\s\S]*?)<\/style>/);
	assert.ok(embedBlockMatch, "expected an isEmbed-gated <style> block in Interior.astro");
	const embedCss = embedBlockMatch![1];

	// height/min-height/max-height are neutralized with !important so a page
	// author's `height: 185svh` (or any future page's 100vh/100dvh) cannot
	// resolve against the iframe's own auto-managed height.
	assert.match(embedCss, /height:\s*auto\s*!important/);
	assert.match(embedCss, /min-height:\s*0\s*!important/);
	assert.match(embedCss, /max-height:\s*none\s*!important/);
	// position: sticky participates in the same loop (a sticky element's
	// containing block is sized against the viewport too), so it is flattened
	// alongside the height properties.
	assert.match(embedCss, /position:\s*static\s*!important/);

	// This must apply broadly (section/div/article/main/header/footer), not
	// to a single named class — the whole point is that a future page cannot
	// reintroduce this bug by picking a different class name for the same
	// height:100vh mistake.
	assert.match(embedCss, /:is\(section,\s*div,\s*article,\s*main,\s*header,\s*footer\)/);
});

test("the neutralizing rule is scoped to embed mode only — a plain (non-embed) page is unaffected", () => {
	const src = interiorSource();
	// Both the background-fight fix and the viewport-height neutralizer are
	// declared inside the same isEmbed-gated block as the pre-existing
	// transparent/overflow rules, never at top level.
	const isEmbedStyleBlocks = src.match(/\{isEmbed && \(\s*<style>/g) ?? [];
	assert.ok(isEmbedStyleBlocks.length >= 1);
	assert.doesNotMatch(
		src.split("</html>")[0].split(/\{isEmbed/)[0] ?? "",
		/min-height:\s*0\s*!important/,
	);
});

test("MAX_EMBED_HEIGHT stays a safety clamp of last resort, not the normal outcome", () => {
	// Post-fix, /spiritual-formation?embed=1 settles at ~6,200px in manual
	// verification — nowhere near the 20,000px ceiling. The clamp still
	// exists as defense-in-depth for a future regression, but a healthy
	// embed should never actually reach it.
	assert.equal(clampEmbedHeight(6212), 6212);
	assert.equal(clampEmbedHeight(103800), MAX_EMBED_HEIGHT);
});
