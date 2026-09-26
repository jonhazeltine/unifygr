import assert from "node:assert/strict";
import test from "node:test";
import { MOUNTED, BARE } from "../src/lib/studio/pages";
import goLinksPage from "../content/pages/go-links.json" with { type: "json" };

// /links/go is its own page, slug "go-links", mounted at /links/go. It
// carries exactly three buttons — Go to the Church, Go to the City, Go to
// the Nations — each opening the Connect card inline with a different
// interest preselected (ambassador, outreach, missions). Rebuilt from the
// old "Go with an Ambassador Team" / "Join a GO Team" / "The Church Map"
// set per Jon's request (2026-09-26): all three now route through Connect,
// so "The Church Map" and the combined "Join a GO Team" link are gone.

function tapButtonsBlock() {
	const block = goLinksPage.content.find((c: any) => c.type === "TapButtons");
	assert.ok(block, "expected a TapButtons block");
	return block;
}

test("the go-links slug mounts at /links/go, bare, and is live", () => {
	assert.equal(MOUNTED["go-links"], "/links/go");
	assert.ok(BARE.has("go-links"));
	assert.equal(goLinksPage.status, "live");
});

test("/links/go carries a back link to /links", () => {
	const block = tapButtonsBlock();
	assert.equal(block.props.homeHref, "/links");
	assert.equal(block.props.homeLabel, "Links");
	assert.equal(block.props.homeIcon, "back");
});

test("/links/go has the 'Go.' heading and lede, and no quote", () => {
	assert.equal(goLinksPage.root.props.title, "Go.");
	const block = tapButtonsBlock();
	assert.equal(block.props.heading, "Go.");
	assert.equal(block.props.lede, "Go with us to pray alongside other churches and serve across Grand Rapids.");
	assert.ok(!(block.props as any).quote, "/links/go should not have a quote");
});

test("/links/go has exactly three buttons, in order Church, City, Nations, with Church gold/featured", () => {
	const block = tapButtonsBlock();
	const links: any[] = block.props.links;
	assert.equal(links.length, 3);
	assert.deepEqual(
		links.map((l: any) => l.label),
		["Go to the Church", "Go to the City", "Go to the Nations"],
	);
	assert.equal(links[0].feature, "yes");
	for (const link of links.slice(1)) {
		assert.equal(link.feature, "no");
	}
});

test("all three buttons are headings only, with no blurbs", () => {
	const block = tapButtonsBlock();
	for (const link of block.props.links as any[]) {
		assert.ok(!link.blurb, `${link.label} should have no blurb`);
	}
});

test("each button opens Connect inline with the right interest and &embed=1", () => {
	const block = tapButtonsBlock();
	const links: any[] = block.props.links;

	const church = links.find((l: any) => l.label === "Go to the Church");
	assert.equal(church.embed, "inline");
	assert.equal(church.href, "/connect?interest=ambassador&from=links+go");
	assert.equal(church.embedSrc, "/connect?interest=ambassador&from=links+go&embed=1");
	assert.equal(church.embedHeight, "80vh");

	const city = links.find((l: any) => l.label === "Go to the City");
	assert.equal(city.embed, "inline");
	assert.equal(city.href, "/connect?interest=outreach&from=links+go");
	assert.equal(city.embedSrc, "/connect?interest=outreach&from=links+go&embed=1");
	assert.equal(city.embedHeight, "80vh");

	const nations = links.find((l: any) => l.label === "Go to the Nations");
	assert.equal(nations.embed, "inline");
	assert.equal(nations.href, "/connect?interest=missions&from=links+go");
	assert.equal(nations.embedSrc, "/connect?interest=missions&from=links+go&embed=1");
	assert.equal(nations.embedHeight, "80vh");
});

test("no button links out to The Church Map or a non-Connect destination", () => {
	const block = tapButtonsBlock();
	for (const link of block.props.links as any[]) {
		assert.ok(link.href.startsWith("/connect?"), `${link.label} should route through Connect`);
	}
});
