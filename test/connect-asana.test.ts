import assert from "node:assert/strict";
import test from "node:test";
import { connectCardFollowerIds, connectCardHtmlNotes } from "../src/lib/connect/asana";

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

test("Connect Card notes include real Asana mentions for every follower", () => {
	assert.equal(
		connectCardHtmlNotes("Prayer request\nPlease call <today>", ["jon-id", "elizabeth-id", "stacy-id"]),
		'<body><strong>Follow-up team:</strong> <a data-asana-gid="jon-id"></a> <a data-asana-gid="elizabeth-id"></a> <a data-asana-gid="stacy-id"></a><br><br>Prayer request<br>Please call &lt;today&gt;</body>',
	);
});
