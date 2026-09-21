import assert from "node:assert/strict";
import test from "node:test";
import { packSignupSummary, parsePackSignup } from "../src/lib/meals-of-hope/pack-signup";

test("a full submission parses with a rounded headcount", () => {
	const result = parsePackSignup({
		firstName: " Jane ",
		lastName: "Doe",
		email: "jane@example.com",
		phone: "(555) 123-4567",
		headcount: "4.0",
	});
	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.fields, {
			firstName: "Jane",
			lastName: "Doe",
			email: "jane@example.com",
			phone: "(555) 123-4567",
			headcount: 4,
		});
	}
});

test("the honeypot field silently marks a submission as spam", () => {
	const result = parsePackSignup({ firstName: "Bot", lastName: "Bot", website: "http://spam.example" });
	assert.deepEqual(result, { ok: false, spam: true });
});

test("first and last name are required", () => {
	const result = parsePackSignup({ firstName: "", lastName: "Doe", email: "jane@example.com", headcount: "2" });
	assert.equal(result.ok, false);
	if (!result.ok && !result.spam) assert.match(result.error, /first and last name/i);
});

test("either an email or a phone is required", () => {
	const result = parsePackSignup({ firstName: "Jane", lastName: "Doe", headcount: "2" });
	assert.equal(result.ok, false);
	if (!result.ok && !result.spam) assert.match(result.error, /email or a mobile number/i);
});

test("a malformed email is rejected", () => {
	const result = parsePackSignup({ firstName: "Jane", lastName: "Doe", email: "not-an-email", headcount: "2" });
	assert.equal(result.ok, false);
	if (!result.ok && !result.spam) assert.match(result.error, /doesn't look right/i);
});

test("a phone-only submission is fine without an email", () => {
	const result = parsePackSignup({ firstName: "Jane", lastName: "Doe", phone: "5551234567", headcount: "2" });
	assert.equal(result.ok, true);
});

for (const bad of ["0", "-1", "", "not a number"]) {
	test(`a headcount of ${JSON.stringify(bad)} is rejected`, () => {
		const result = parsePackSignup({ firstName: "Jane", lastName: "Doe", email: "jane@example.com", headcount: bad });
		assert.equal(result.ok, false);
		if (!result.ok && !result.spam) assert.match(result.error, /how many people/i);
	});
}

test("the summary reads naturally for one person and for a team", () => {
	const solo = packSignupSummary({ firstName: "Jane", lastName: "Doe", email: "jane@example.com", headcount: 1 });
	assert.match(solo, /Expecting 1 person, including themself\./);

	const team = packSignupSummary({ firstName: "Jane", lastName: "Doe", phone: "5551234567", headcount: 6 });
	assert.match(team, /Expecting 6 people, including themself\./);
	assert.match(team, /Phone: 5551234567/);
	assert.doesNotMatch(team, /Email:/);
});
