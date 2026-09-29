import assert from "node:assert/strict";
import test from "node:test";
import directory from "../content/ministries.json" with { type: "json" };

// The Prayer ministry page (content/ministries.json slug "corporate-prayer",
// rendered at /ministry/corporate-prayer) needs two prayer buttons (Jon,
// 2026-09-29): "Request prayer" opens the Connect card with the prayer
// interest, and "Pray for the church and city" links to /links/pray.
function prayerEntry() {
	const entry = (directory.entries as any[]).find((e) => e.slug === "corporate-prayer");
	assert.ok(entry, "expected a corporate-prayer entry");
	return entry;
}

test("the Prayer ministry page has a Request prayer button to the Connect card", () => {
	const entry = prayerEntry();
	const cta = entry.ctas?.find((c: any) => c.label === "Request prayer");
	assert.ok(cta, "expected a Request prayer CTA");
	assert.equal(cta.href, "/connect?interest=prayer");
});

test("the Prayer ministry page has a Pray for the church and city button to /links/pray", () => {
	const entry = prayerEntry();
	const cta = entry.ctas?.find((c: any) => c.label === "Pray for the church and city");
	assert.ok(cta, "expected a Pray for the church and city CTA");
	assert.equal(cta.href, "/links/pray");
});

test("the Prayer ministry page does not claim a staffed Connections desk", () => {
	const entry = prayerEntry();
	const text = JSON.stringify(entry).toLowerCase();
	assert.ok(!text.includes("connections desk"));
});
