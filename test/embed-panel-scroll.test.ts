import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
	clampEmbedHeight,
	parseEmbedHeightMessage,
	findEmbedFrame,
	MIN_EMBED_HEIGHT,
	MAX_EMBED_HEIGHT,
} from "../src/lib/embed/panel-height";
import { blocksConfig } from "../src/components/builder/blocks.tsx";
import fs from "node:fs";

// The inline tap/next-steps panels used to nest three scrollers (page, panel,
// iframe content). The fix: a frame we control posts its real height up via
// postMessage, and the panel listener in MountedPage.astro (backed by these
// pure helpers) grows the panel to match instead of giving the frame its own
// scrollbar. These tests cover the two things most likely to regress
// silently — clamping to a sane minimum/maximum, and only ever trusting the
// iframe that actually sent the message.

test("parseEmbedHeightMessage accepts only a well-formed nlgr-embed-height payload", () => {
	assert.equal(parseEmbedHeightMessage({ type: "nlgr-embed-height", height: 480 }), 480);
	assert.equal(parseEmbedHeightMessage({ type: "nlgr-embed-height", height: "612" }), 612);
	assert.equal(parseEmbedHeightMessage(null), null);
	assert.equal(parseEmbedHeightMessage(undefined), null);
	assert.equal(parseEmbedHeightMessage("just a string"), null);
	assert.equal(parseEmbedHeightMessage({ type: "something-else", height: 480 }), null);
	assert.equal(parseEmbedHeightMessage({ type: "nlgr-embed-height", height: 0 }), null);
	assert.equal(parseEmbedHeightMessage({ type: "nlgr-embed-height", height: -40 }), null);
	assert.equal(parseEmbedHeightMessage({ type: "nlgr-embed-height", height: "not a number" }), null);
});

test("clampEmbedHeight never collapses the panel to nothing or lets it run away", () => {
	assert.equal(clampEmbedHeight(1), MIN_EMBED_HEIGHT);
	assert.equal(clampEmbedHeight(0), MIN_EMBED_HEIGHT);
	assert.equal(clampEmbedHeight(-500), MIN_EMBED_HEIGHT);
	assert.equal(clampEmbedHeight(612), 612);
	assert.equal(clampEmbedHeight(612.4), 612);
	assert.equal(clampEmbedHeight(500000), MAX_EMBED_HEIGHT);
});

test("the maximum is a sanity bound only, high enough that a long page like Growth Track never scrolls inside its panel", () => {
	assert.equal(MAX_EMBED_HEIGHT, 20000);
	assert.equal(clampEmbedHeight(12000), 12000);
});

test("findEmbedFrame matches only the iframe whose contentWindow sent the message", () => {
	const ours = { contentWindow: { id: "ours" } };
	const churchMap = { contentWindow: { id: "church-map" } };
	const frames = [ours, churchMap];

	assert.equal(findEmbedFrame(frames, ours.contentWindow), ours);
	assert.equal(findEmbedFrame(frames, churchMap.contentWindow), churchMap);
	// A message whose source is some other window (e.g. an ad inside
	// SecureGive, or a stray message from elsewhere on the page) matches
	// nothing, so it can never resize a panel it didn't come from.
	assert.equal(findEmbedFrame(frames, { id: "not one of ours" }), null);
	assert.equal(findEmbedFrame(frames, null), null);
	assert.equal(findEmbedFrame([], ours.contentWindow), null);
});

test("ConnectEmbed and Interior (embed mode) post their document height and hide their own scrollbar", () => {
	const connectEmbed = fs.readFileSync(new URL("../src/layouts/ConnectEmbed.astro", import.meta.url), "utf8");
	assert.match(connectEmbed, /overflow:\s*hidden/);
	assert.match(connectEmbed, /nlgr-embed-height/);
	assert.match(connectEmbed, /ResizeObserver/);
	assert.match(connectEmbed, /nlgr:embed-height-refresh/);
	assert.match(connectEmbed, /document\.fonts\?\.ready/);

	const interior = fs.readFileSync(new URL("../src/layouts/Interior.astro", import.meta.url), "utf8");
	assert.match(interior, /nlgr-embed-height/);
	assert.match(interior, /ResizeObserver/);
	// The posting script and the overflow:hidden rule both only render inside
	// the `{isEmbed && (...)}` block, so a plain (non-embed) Interior page —
	// the vast majority of the site — is completely unchanged.
	const isEmbedBlocks = interior.match(/\{isEmbed && \(/g) ?? [];
	assert.ok(isEmbedBlocks.length >= 2, "expected both the embed <style> and the embed <script> to be gated on isEmbed");
});

test("the Connect form dispatches an embed-height refresh when it grows (toggle expand, thank-you)", () => {
	const form = fs.readFileSync(new URL("../src/components/connect/ConnectForm.astro", import.meta.url), "utf8");
	const refreshCount = (form.match(/nlgr:embed-height-refresh/g) ?? []).length;
	assert.ok(refreshCount >= 2, "expected a refresh dispatch after both the toggle expand and the thank-you screen");
});

test("a SecureGive button with no explicit height falls back to a phone-tuned fixed height", () => {
	const tapButtons = blocksConfig.components.TapButtons;
	const html = renderToStaticMarkup(
		tapButtons.render({
			links: [{ label: "Give", href: "https://app.securegive.com/x", embed: "securegive" }],
		} as any),
	);
	assert.match(html, /--tapbtn-embed-panel-height:760px/);
});

test("an explicit embedHeight still overrides the SecureGive default", () => {
	const tapButtons = blocksConfig.components.TapButtons;
	const html = renderToStaticMarkup(
		tapButtons.render({
			links: [{ label: "Give", href: "https://app.securegive.com/x", embed: "securegive", embedHeight: "500px" }],
		} as any),
	);
	assert.match(html, /--tapbtn-embed-panel-height:500px/);
});
