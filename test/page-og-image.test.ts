import assert from "node:assert/strict";
import test from "node:test";
import { pageOgImage } from "../src/lib/studio/pages";

test("a mounted builder page with a hand-made thumbnail uses it", () => {
	assert.equal(pageOgImage("/meals-of-hope"), "/art/studio-thumbs/meals-of-hope.webp");
	assert.equal(pageOgImage("/staff"), "/art/studio-thumbs/staff.webp");
});

test("a /p/<slug> builder page with a hand-made thumbnail uses it", () => {
	assert.equal(pageOgImage("/p/welcome"), "/art/studio-thumbs/welcome.webp");
});

test("a hand-built page falls back to the studio-page-previews convention", () => {
	assert.equal(pageOgImage("/giving"), "/art/studio-page-previews/giving.webp");
	assert.equal(pageOgImage("/about"), "/art/studio-page-previews/about.webp");
	assert.equal(pageOgImage("/"), "/art/studio-page-previews/home.webp");
});

test("a nested path turns its slashes into the convention's double-dash", () => {
	assert.equal(pageOgImage("/ministries/calendar"), "/art/studio-page-previews/ministries--calendar.webp");
});

test("a known gap (no real art yet) falls through to BaseHead's own default instead of a broken image", () => {
	assert.equal(pageOgImage("/app"), undefined);
});
