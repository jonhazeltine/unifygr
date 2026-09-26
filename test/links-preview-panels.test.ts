import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { blocksConfig } from "../src/components/builder/blocks.tsx";
import linksPage from "../content/pages/links.json" with { type: "json" };
import newPage from "../content/pages/new.json" with { type: "json" };
import growPage from "../content/pages/next-steps.json" with { type: "json" };

// Jon asked that "Welcome to New Life" and "The Formation App" show a short
// description of where the visitor is headed before they go, using the same
// inline panel Give already opens (same open/close, animation, close
// button), instead of navigating straight away. No iframe: the panel shows
// text plus one gold "Continue"-style button that opens the href in a new
// tab, so the installed-app deep link (theformation.app/m/... and the
// community query-param link) still works the way a plain navigation would.
//
// Both buttons moved off /links in the I'm New / Grow / Go / Give
// restructure: "Welcome to New Life" now lives on /links/new, and "The
// Formation App" now lives on /links/grow (slug "next-steps") — but they
// kept their preview panels exactly as they were on /links.

function tapButtonsLinks(page: any) {
	const block = page.content.find((c: any) => c.type === "TapButtons");
	return block!.props.links as any[];
}

test("Welcome to New Life carries its preview content on /links/new", () => {
	const links = tapButtonsLinks(newPage);

	const welcome = links.find((l) => l.label === "Welcome to New Life");
	assert.ok(welcome);
	assert.equal(
		welcome.preview,
		"A short video series on who we are: our story, values, vision and mission, and what it means to be part of New Life.",
	);
	assert.equal(welcome.previewAction, "Watch the series");
	assert.equal(welcome.href, "https://theformation.app/m/welcome-to-new-life", "href stays unchanged");
});

test("The Formation App carries its preview content on /links/grow", () => {
	const links = tapButtonsLinks(growPage);

	const app = links.find((l) => l.label === "The Formation App");
	assert.ok(app);
	assert.equal(
		app.preview,
		"Our community app for growing in faith day by day: guided paths, Life Group resources and what is happening at New Life.",
	);
	assert.equal(app.previewAction, "Open the app");
	assert.equal(
		app.href,
		"https://theformation.app/join/0LY0R",
		"href stays unchanged",
	);
});

test("no /links button carries preview content any more — those buttons moved to /links/new and /links/grow", () => {
	const links = tapButtonsLinks(linksPage);
	for (const link of links) {
		assert.ok(!link.preview, `expected "${link.label}" to have no preview text`);
		assert.ok(!link.previewAction, `expected "${link.label}" to have no preview action label`);
	}
});

test("a link with preview text renders the inline panel with the description and a new-tab action button, no iframe", () => {
	const tapButtons = blocksConfig.components.TapButtons;
	const html = renderToStaticMarkup(
		tapButtons.render({
			links: [
				{
					label: "Welcome to New Life",
					href: "https://theformation.app/m/welcome-to-new-life",
					preview: "A short video series on who we are.",
					previewAction: "Watch the series",
				},
			],
		} as any),
	);

	// The visible trigger stays a real, unmodified link to the href (no-JS fallback).
	assert.match(html, /href="https:\/\/theformation\.app\/m\/welcome-to-new-life"/);
	assert.match(html, /data-tapbtn-embed="preview"/);

	// The panel shows the description text.
	assert.match(html, /A short video series on who we are\./);

	// The action button opens the same href in a new tab.
	assert.match(
		html,
		/<a class="button button--primary tapbtn-embed-panel__preview-action" href="https:\/\/theformation\.app\/m\/welcome-to-new-life" target="_blank" rel="noopener">Watch the series<\/a>/,
	);

	// No iframe panel/frame markup for a preview item.
	assert.doesNotMatch(html, /data-tapbtn-embed-frame/);
	assert.doesNotMatch(html, /<iframe/);
});

test("a preview action button defaults to \"Continue\" when no previewAction is set", () => {
	const tapButtons = blocksConfig.components.TapButtons;
	const html = renderToStaticMarkup(
		tapButtons.render({
			links: [
				{
					label: "The Formation App",
					href: "https://theformation.app/join/0LY0R",
					preview: "Our community app.",
				},
			],
		} as any),
	);
	assert.match(html, />Continue<\/a>/);
});

test("a link with no preview text renders the normal plain link, not a panel", () => {
	const tapButtons = blocksConfig.components.TapButtons;
	const html = renderToStaticMarkup(
		tapButtons.render({
			links: [
				{
					label: "Go",
					href: "/links/go",
				},
			],
		} as any),
	);
	assert.doesNotMatch(html, /data-tapbtn-embed/);
	assert.doesNotMatch(html, /tapbtn-embed-panel/);
});
