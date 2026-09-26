import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { blocksConfig } from "../src/components/builder/blocks.tsx";
import goLinksPage from "../content/pages/go-links.json" with { type: "json" };
import nextStepsPage from "../content/pages/next-steps.json" with { type: "json" };

// Jon asked that the Connect Card open inline on /links/go and
// /links/grow, the same way Give already does on /links, instead of
// navigating away. These buttons carry the flags TapButtons needs
// (blocks.tsx) and their href is untouched so a no-JS visitor still lands on
// the real, full /connect page — never the bare embed=1 variant.
//
// /links/go is its own page (slug "go-links"), holding exactly three
// buttons — Go to the Church, Go to the City, Go to the Nations — each an
// inline Connect Card with a different interest preselected (2026-09-26).

function connectButtons(page: any) {
	const block = page.content.find((c: any) => c.type === "TapButtons");
	return (block!.props.links as any[]).filter((l) => String(l.href || "").startsWith("/connect"));
}

test("/links/go flags all three Connect Card buttons for inline embedding", () => {
	const buttons = connectButtons(goLinksPage);
	assert.equal(buttons.length, 3);

	const church = buttons.find((b) => b.label === "Go to the Church");
	assert.ok(church);
	assert.equal(church.embed, "inline");
	// No-JS visitors still get the full, chrome-on /connect page.
	assert.equal(church.href, "/connect?interest=ambassador&from=links+go");
	// The iframe loads the embed=1 variant of the exact same URL.
	assert.equal(church.embedSrc, "/connect?interest=ambassador&from=links+go&embed=1");

	const city = buttons.find((b) => b.label === "Go to the City");
	assert.ok(city);
	assert.equal(city.embed, "inline");
	assert.equal(city.href, "/connect?interest=outreach&from=links+go");
	assert.equal(city.embedSrc, "/connect?interest=outreach&from=links+go&embed=1");

	const nations = buttons.find((b) => b.label === "Go to the Nations");
	assert.ok(nations);
	assert.equal(nations.embed, "inline");
	assert.equal(nations.href, "/connect?interest=missions&from=links+go");
	assert.equal(nations.embedSrc, "/connect?interest=missions&from=links+go&embed=1");
});

test("/links/grow flags its remaining Connect Card button for inline embedding", () => {
	const buttons = connectButtons(nextStepsPage);
	assert.equal(buttons.length, 1);

	const lifeGroup = buttons.find((b) => b.label === "Join a Life Group");
	assert.ok(lifeGroup);
	assert.equal(lifeGroup.embed, "inline");
	assert.equal(lifeGroup.href, "/connect?interest=group&from=next+steps+page");
	assert.equal(lifeGroup.embedSrc, "/connect?interest=group&from=next+steps+page&embed=1");
});

test("every other button on both pages is left as a normal, non-embedded link", () => {
	for (const page of [goLinksPage, nextStepsPage]) {
		const block = page.content.find((c: any) => c.type === "TapButtons");
		const links: any[] = block!.props.links;
		for (const link of links) {
			if (String(link.href || "").startsWith("/connect")) continue;
			if (link.label === "Strengthen the Church" || link.label === "Pray for a Person") continue; // Church Map card-only embeds
			if (link.label === "Growth Track") continue; // preview panel, not an inline embed — see links-preview-panels.test.ts
			assert.ok(!link.embed, `expected "${link.label}" to stay a normal link`);
		}
	}
});

test("TapButtons renders an embed frame whose src is embedSrc, not the visible href", () => {
	const tapButtons = blocksConfig.components.TapButtons;
	const html = renderToStaticMarkup(
		tapButtons.render({
			links: [
				{
					label: "Go with an Ambassador Team",
					href: "/connect?interest=ambassador&from=tap+page",
					embed: "inline",
					embedSrc: "/connect?interest=ambassador&from=tap+page&embed=1",
				},
			],
		} as any),
	);

	// The clickable link (progressive-enhancement, no-JS target) stays on the full page.
	assert.match(html, /href="\/connect\?interest=ambassador&amp;from=tap\+page"/);
	// The iframe panel's data-src is the embed=1 variant, from embedSrc.
	assert.match(html, /data-src="\/connect\?interest=ambassador&amp;from=tap\+page&amp;embed=1"/);
});

test("when no embedSrc is set, the embed frame falls back to href (e.g. Strengthen the Church)", () => {
	const tapButtons = blocksConfig.components.TapButtons;
	const html = renderToStaticMarkup(
		tapButtons.render({
			links: [
				{
					label: "Strengthen the Church",
					href: "https://thechurchmap.com/grandrapids/pray?embed=1",
					embed: "inline",
				},
			],
		} as any),
	);
	assert.match(html, /data-src="https:\/\/thechurchmap\.com\/grandrapids\/pray\?embed=1"/);
});
