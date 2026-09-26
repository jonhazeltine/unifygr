import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Jon approved a reordered layout for embed=1 ONLY (2026-09-26): the
// prefilled interest surfaces as a confirmation up top with the rest of the
// checklist collapsed behind "Add something else", and the contact fields
// move to sit directly above Submit. The full /connect page must keep its
// original markup order untouched.
//
// The component has a single shared copy of the contact-field markup (no
// per-mode duplication): everything embed-only (the confirmation, the
// collapsible checklist, the message field) is written BEFORE it in source
// and gated on `embed`/`showConfirmation`; everything that only belongs on
// the full page (the standalone checklist + message) is written AFTER it,
// gated on `!embed`. So source order IS render order for each mode — reading
// the file, as the codebase's other markup tests already do, is a faithful
// check.

const root = fileURLToPath(new URL("..", import.meta.url));
const connectForm = readFileSync(`${root}src/components/connect/ConnectForm.astro`, "utf8");

function idx(needle: string, label: string): number {
	const i = connectForm.indexOf(needle);
	assert.notEqual(i, -1, `expected to find ${label}`);
	return i;
}

test("embed layout: the interest confirmation renders before the contact fields", () => {
	const confirmGate = idx("const showConfirmation = embed && pickedItems.length > 0;", "the showConfirmation gate");
	const confirmHeading = idx('id="interest-confirm-heading"', "the interest confirmation heading");
	const collapsibleChecklist = idx('id="interest-more"', "the collapsible checklist section");
	const firstName = idx('name="firstName"', "the First name input");

	assert.ok(confirmGate < confirmHeading, "showConfirmation is computed before it's used");
	assert.ok(confirmHeading < firstName, "interest confirmation comes before the contact fields");
	assert.ok(collapsibleChecklist < firstName, "the (collapsible, in embed mode) checklist comes before the contact fields");
});

test("embed layout: the contact fields sit immediately above Submit, with nothing else between Phone and the non-embed-only block", () => {
	const firstName = idx('name="firstName"', "the First name input");
	const lastName = idx('name="lastName"', "the Last name input");
	const email = idx('name="email"', "the Email input");
	const phone = idx('name="phone"', "the Phone input");
	const nonEmbedGate = idx("{!embed && (", "the non-embed-only gate");
	const submit = idx('id="connect-submit"', "the Submit button");

	assert.ok(firstName < lastName && lastName < email && email < phone, "contact fields run First, Last, Email, Phone");
	assert.ok(phone < nonEmbedGate, "contact fields come before the non-embed-only block (which never renders in embed mode)");
	assert.ok(nonEmbedGate < submit, "Submit comes after that block");

	// Nothing but whitespace/closing tags sits between the Phone field and the
	// start of the non-embed-only gate — so in embed mode (where that whole
	// gated block renders nothing), the contact fields land directly above
	// Submit's honeypot/error/button group.
	const betweenPhoneAndGate = connectForm.slice(connectForm.indexOf('name="phone"'), nonEmbedGate);
	assert.doesNotMatch(betweenPhoneAndGate, /<input|<textarea|<label/);
});

test("embed layout: the message field is kept, placed between the interest area and the contact fields", () => {
	const collapsibleChecklist = idx('id="interest-more"', "the collapsible checklist section");
	const embedMessage = idx("Anything you'd like us to know", "the embed-only message field");
	const firstName = idx('name="firstName"', "the First name input");

	// The FIRST occurrence of the message copy in the file is the embed-only
	// one (the non-embed copy, gated on !embed, comes later in the file).
	assert.ok(collapsibleChecklist < embedMessage, "message field comes after the interest area");
	assert.ok(embedMessage < firstName, "message field comes before the contact fields");
	assert.match(connectForm.slice(collapsibleChecklist, firstName), /\{embed && \(/, "the message field there is gated on embed");
});

test("embed layout: the 'Add something else' toggle is present only when an interest is prefilled", () => {
	const toggleText = idx('id="interest-toggle"', "the toggle button element");
	const showConfirmGate = idx("{showConfirmation && (", "the showConfirmation-gated block");
	const nonEmbedGate = idx("{!embed && (", "the non-embed-only gate");
	assert.ok(showConfirmGate < toggleText && toggleText < nonEmbedGate, "the toggle lives inside the showConfirmation-gated block");
});

test("embed layout: with no interest prefilled, the full checklist renders expanded (hidden is tied to showConfirmation, which requires a pick)", () => {
	assert.match(connectForm, /const pickedItems = picked \? allItems\.filter\(\(item\) => item\.id === picked\) : \[\];/);
	assert.match(connectForm, /const showConfirmation = embed && pickedItems\.length > 0;/);
	assert.match(connectForm, /hidden=\{showConfirmation\}/);
});

test("non-embed /connect page keeps its current markup order: contact fields, then the interest checklist, then the message field, then Submit", () => {
	const nonEmbedGate = idx("{!embed && (", "the non-embed-only gate");
	const nonEmbedSection = connectForm.slice(nonEmbedGate);

	const choices = nonEmbedSection.indexOf("field--choices");
	const message = nonEmbedSection.indexOf("Anything you'd like us to know");
	const submitFromGate = nonEmbedSection.indexOf('id="connect-submit"');

	assert.ok(choices > -1 && message > -1 && submitFromGate > -1);
	assert.ok(choices < message, "checklist before the message field, as today");
	assert.ok(message < submitFromGate, "message field before Submit, as today");

	// And the contact fields (shared, single copy) still come before all of this.
	const email = idx('name="email"', "the Email input");
	assert.ok(email < nonEmbedGate, "contact fields render before the non-embed checklist/message, as today");
});
