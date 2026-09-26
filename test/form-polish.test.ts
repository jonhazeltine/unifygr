import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateConnectPayload } from "../src/pages/api/connect/submit.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const connectForm = readFileSync(`${root}src/components/connect/ConnectForm.astro`, "utf8");
const blocks = readFileSync(`${root}src/components/builder/blocks.tsx`, "utf8");

test("the helper line is gone from every public form", () => {
	assert.doesNotMatch(connectForm, /Either one is fine/);
	assert.doesNotMatch(blocks, /Either one is fine/);
});

test("the Connect Card no longer collects a City field", () => {
	assert.doesNotMatch(connectForm, /name="city"/);
	assert.doesNotMatch(connectForm, /<span>City<\/span>/);
});

test("Connect Card name/email/phone inputs carry autocomplete + name for autofill", () => {
	assert.match(connectForm, /name="firstName" type="text" autocomplete="given-name"/);
	assert.match(connectForm, /name="lastName" type="text" autocomplete="family-name"/);
	assert.match(connectForm, /name="email" type="email" autocomplete="email" inputmode="email"/);
});

test("Connect Card phone input is type=tel with inputmode=tel and a digit pattern", () => {
	assert.match(connectForm, /name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[^"]+"/);
});

test("the Meals of Hope pack-signup form carries the same autocomplete/name and tel attributes", () => {
	assert.match(blocks, /name="firstName" type="text" autoComplete="given-name"/);
	assert.match(blocks, /name="lastName" type="text" autoComplete="family-name"/);
	assert.match(blocks, /name="email" type="email" autoComplete="email" inputMode="email"/);
	assert.match(blocks, /name="phone" type="tel" autoComplete="tel" inputMode="tel" pattern="[^"]+"/);
});

test("the pack-signup headcount field is numeric-only", () => {
	assert.match(blocks, /name="headcount" type="number" min="1" step="1" inputMode="numeric" pattern="\[0-9\]\*"/);
});

test("a Connect Card payload with no city validates fine", () => {
	const result = validateConnectPayload({
		firstName: "Jane",
		lastName: "Doe",
		email: "jane@example.com",
		interests: ["prayer"],
	});
	assert.equal(result.ok, true);
});

test("a Connect Card payload still requires a name and a way to reach them, city or not", () => {
	const noContact = validateConnectPayload({ firstName: "Jane", lastName: "Doe", interests: ["prayer"] });
	assert.equal(noContact.ok, false);
	if (!noContact.ok && !noContact.spam) assert.match(noContact.error, /email or a phone number/i);

	const noName = validateConnectPayload({ email: "jane@example.com", interests: ["prayer"] });
	assert.equal(noName.ok, false);
});

test("the honeypot still marks a payload as spam even with no city", () => {
	const result = validateConnectPayload({ firstName: "Bot", lastName: "Bot", website: "http://spam.example" });
	assert.deepEqual(result, { ok: false, spam: true });
});
