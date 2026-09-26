import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { blocksConfig } from "../src/components/builder/blocks.tsx";
import tapPage from "../content/pages/tap.json" with { type: "json" };
import nextStepsPage from "../content/pages/next-steps.json" with { type: "json" };

// Jon asked that the Connect Card open inline on /links/pray and
// /links/next-steps, the same way Give already does on /links, instead of
// navigating away. These buttons carry the flags TapButtons needs
// (blocks.tsx) and their href is untouched so a no-JS visitor still lands on
// the real, full /connect page — never the bare embed=1 variant.

function connectButtons(page: any) {
	const block = page.content.find((c: any) => c.type === "TapButtons");
	return (block!.props.links as any[]).filter((l) => String(l.href || "").startsWith("/connect"));
}

test("/links/pray flags its Connect Card button ('Go with an Ambassador Team') for inline embedding", () => {
	const buttons = connectButtons(tapPage);
	assert.equal(buttons.length, 1);
	const [button] = buttons;
	assert.equal(button.label, "Go with an Ambassador Team");
	assert.equal(button.embed, "inline");
	// No-JS visitors still get the full, chrome-on /connect page.
	assert.equal(button.href, "/connect?interest=ambassador&from=tap+page");
	// The iframe loads the embed=1 variant of the exact same URL.
	assert.equal(button.embedSrc, "/connect?interest=ambassador&from=tap+page&embed=1");
});

test("/links/next-steps flags both of its Connect Card buttons for inline embedding", () => {
	const buttons = connectButtons(nextStepsPage);
	assert.equal(buttons.length, 2);

	const lifeGroup = buttons.find((b) => b.label === "Join a Life Group");
	assert.ok(lifeGroup);
	assert.equal(lifeGroup.embed, "inline");
	assert.equal(lifeGroup.href, "/connect?interest=group&from=next+steps+page");
	assert.equal(lifeGroup.embedSrc, "/connect?interest=group&from=next+steps+page&embed=1");

	const goTeam = buttons.find((b) => b.label === "Join a GO Team");
	assert.ok(goTeam);
	assert.equal(goTeam.embed, "inline");
	// The href keeps its #teams anchor for no-JS visitors landing on the full page.
	assert.equal(goTeam.href, "/connect?from=next+steps+page#teams");
	// embed=1 has to land in the query string, before the fragment, or it's
	// swallowed into the anchor instead of being read as a param.
	assert.equal(goTeam.embedSrc, "/connect?from=next+steps+page&embed=1#teams");
});

test("every other button on both pages is left as a normal, non-embedded link", () => {
	for (const page of [tapPage, nextStepsPage]) {
		const block = page.content.find((c: any) => c.type === "TapButtons");
		const links: any[] = block!.props.links;
		for (const link of links) {
			if (String(link.href || "").startsWith("/connect")) continue;
			if (link.label === "Strengthen the Church" || link.label === "Pray for a Person") continue; // Church Map card-only embeds
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
