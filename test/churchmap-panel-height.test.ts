import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { findEmbedFrame } from "../src/lib/embed/panel-height";
import tapPage from "../content/pages/tap.json" with { type: "json" };

// The "Strengthen the Church" panel on /links/pray frames The Church Map
// (a different origin), which posts its real document height back via
// postMessage so the panel can grow/shrink to fit instead of clipping the
// Submit prayer button. These tests cover the three things that would
// silently defeat that: the listener rejecting a cross-origin source, a
// missing referrerpolicy leaving Safari/iOS unable to resolve the parent
// origin, and a fixed embedHeight overriding the dynamic measurement.

test("the panel listener accepts a message from a cross-origin frame (matched by source identity, not origin string)", () => {
	// findEmbedFrame is exactly what MountedPage.astro's "message" listener
	// uses to decide whether to trust a height report — it never compares
	// event.origin against an allowlist, so a thechurchmap.com frame (a
	// different origin than our own ?embed=1 pages) matches the same way our
	// own frames do, as long as it's a window we actually put in an iframe.
	const churchMapFrame = { contentWindow: { id: "thechurchmap.com-window" } };
	const ourFrame = { contentWindow: { id: "our-embed-window" } };
	const frames = [ourFrame, churchMapFrame];

	assert.equal(findEmbedFrame(frames, churchMapFrame.contentWindow), churchMapFrame);
	// A message from anything not in our list of embed frames (e.g. some
	// other cross-origin script on the page) still matches nothing.
	assert.equal(findEmbedFrame(frames, { id: "unrelated-window" }), null);
});

test("the inline embed iframe sets referrerpolicy so Safari/iOS (no location.ancestorOrigins) can still resolve the parent origin", () => {
	const mountedPage = fs.readFileSync(new URL("../src/components/builder/MountedPage.astro", import.meta.url), "utf8");
	assert.match(
		mountedPage,
		/iframe\.referrerPolicy\s*=\s*["']strict-origin-when-cross-origin["']/,
		"expected the dynamically created embed iframe to set referrerPolicy so a framed page can read document.referrer for its parent's origin",
	);
});

test("neither Church Map button on /links/pray carries a fixed embedHeight that would override the posted height", () => {
	const block = tapPage.content.find((c: any) => c.type === "TapButtons");
	const links: any[] = block!.props.links;
	const churchMapLabels = ["Strengthen the Church", "Pray for a Person"];
	for (const link of links) {
		if (!churchMapLabels.includes(link.label)) continue;
		assert.ok(
			!("embedHeight" in link) || !String(link.embedHeight || "").trim(),
			`expected "${link.label}" to have no fixed embedHeight, so it relies on the posted height (falling back to the CSS default min(80vh,700px) until the first message arrives)`,
		);
	}
});
