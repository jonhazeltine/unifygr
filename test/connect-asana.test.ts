import assert from "node:assert/strict";
import test from "node:test";
import { connectCardFollowerIds } from "../src/lib/connect/asana";

test("Connect Card follower ids come from the configured comma-separated list", () => {
	const before = process.env.ASANA_FOLLOWER_IDS;
	process.env.ASANA_FOLLOWER_IDS = " jon-id,elizabeth-id, stacy-id ";

	assert.deepEqual(connectCardFollowerIds(), ["jon-id", "elizabeth-id", "stacy-id"]);

	if (before === undefined) delete process.env.ASANA_FOLLOWER_IDS;
	else process.env.ASANA_FOLLOWER_IDS = before;
});

test("Connect Card follower ids are optional", () => {
	const before = process.env.ASANA_FOLLOWER_IDS;
	delete process.env.ASANA_FOLLOWER_IDS;

	assert.deepEqual(connectCardFollowerIds(), []);

	if (before !== undefined) process.env.ASANA_FOLLOWER_IDS = before;
});
