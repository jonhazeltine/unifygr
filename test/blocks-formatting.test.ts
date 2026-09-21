import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inlineFormatting } from "../src/components/builder/blocks.tsx";

describe("inlineFormatting", () => {
	it("turns **bold** into <strong>", () => {
		assert.equal(inlineFormatting("This is **important**."), "This is <strong>important</strong>.");
	});

	it("turns *italic* into <em>", () => {
		assert.equal(inlineFormatting("This is *emphasized*."), "This is <em>emphasized</em>.");
	});

	it("handles bold and italic together in one line", () => {
		assert.equal(
			inlineFormatting("**Bold** and *italic* together."),
			"<strong>Bold</strong> and <em>italic</em> together.",
		);
	});

	it("consumes a bold run's asterisks before italic ever sees them", () => {
		// If italic ran first, "**word**" would misparse as *<em>word</em>*.
		assert.equal(inlineFormatting("**word**"), "<strong>word</strong>");
	});

	it("leaves plain text with no markers untouched", () => {
		assert.equal(inlineFormatting("Nothing special here."), "Nothing special here.");
	});

	it("escapes HTML first, so a text field can never inject arbitrary markup", () => {
		assert.equal(
			inlineFormatting('<script>alert("hi")</script>'),
			"&lt;script&gt;alert(\"hi\")&lt;/script&gt;",
		);
	});

	it("escapes HTML even inside a bold/italic run", () => {
		assert.equal(inlineFormatting("**<b>fake</b>**"), "<strong>&lt;b&gt;fake&lt;/b&gt;</strong>");
	});

	it("handles an empty or missing value without throwing", () => {
		assert.equal(inlineFormatting(""), "");
		assert.equal(inlineFormatting(undefined as unknown as string), "");
	});
});
