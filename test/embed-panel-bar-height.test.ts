import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression: the posted height is the frame's content height, so in auto mode
// it must size the frame row, not the whole panel (whose close bar would
// otherwise eat ~57px and clip the bottom of the framed card).
const css = readFileSync(new URL("../src/styles/tap.css", import.meta.url), "utf8");

test("auto-height panels size the frame row, not the whole panel", () => {
	assert.match(css, /\.tapbtn-embed-panel\.tapbtn-embed-panel--auto\s*\{[^}]*height:\s*auto/);
	assert.match(css, /\.tapbtn-embed-panel--auto \.tapbtn-embed-panel__frame\s*\{[^}]*height:\s*var\(--tapbtn-embed-panel-height\)/);
});
