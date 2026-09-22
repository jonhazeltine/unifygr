import assert from "node:assert/strict";
import test from "node:test";
import { blockAnchorId } from "../src/components/builder/blocks";

test("a plain block's anchor is just its own Puck id", () => {
	assert.equal(blockAnchorId({ type: "Prose", props: { id: "Prose-moh-why" } }), "Prose-moh-why");
});

test("a block with no id at all has no anchor", () => {
	assert.equal(blockAnchorId({ type: "Prose", props: {} }), undefined);
});

test("GivingEmbed uses its anchorId field, not its Puck id", () => {
	assert.equal(blockAnchorId({ type: "GivingEmbed", props: { id: "GivingEmbed-giving", anchorId: "give-online" } }), "give-online");
});

test("GivingEmbed without a saved anchorId (data from before the field existed) falls back to the same default its render uses", () => {
	assert.equal(blockAnchorId({ type: "GivingEmbed", props: { id: "GivingEmbed-moh" } }), "give-meals");
});

test("PackSignupForm without a saved anchorId falls back to its render's default", () => {
	assert.equal(blockAnchorId({ type: "PackSignupForm", props: { id: "PackSignupForm-moh" } }), "volunteer-to-pack");
});

test("PackSignupForm respects an explicitly saved anchorId over the default", () => {
	assert.equal(blockAnchorId({ type: "PackSignupForm", props: { id: "PackSignupForm-moh", anchorId: "custom-signup" } }), "custom-signup");
});
