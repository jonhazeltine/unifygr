import assert from "node:assert/strict";
import test from "node:test";
import { messageStartFromDescription, parseChannelFeed } from "../src/lib/youtube";

test("finds the Message chapter rather than the first timestamp", () => {
	assert.equal(
		messageStartFromDescription("0:00 Worship\n43:00 Announcements\n47:40 Message — Our Heritage\n1:28:40 Response"),
		2860,
	);
	assert.equal(messageStartFromDescription("0:00 Worship\n1:08:00 Response"), null);
});

test("carries a published Message chapter into a channel video", () => {
	const feed = `<feed><entry><yt:videoId>k-_9XeZzT4Q</yt:videoId><title>Sunday Morning</title><published>2026-09-07T04:16:21Z</published><media:description>0:00 Worship\n47:40 Message</media:description></entry></feed>`;
	assert.equal(parseChannelFeed(feed)[0]?.messageStartSeconds, 2860);
});
