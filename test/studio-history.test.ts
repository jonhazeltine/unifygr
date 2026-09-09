import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const historyPage = new URL("../src/pages/studio/history.astro", import.meta.url);
const studioDock = new URL("../src/components/StudioDock.astro", import.meta.url);

test("history Studio route is staff-gated and preserves the existing Asana review path", async () => {
	const source = await readFile(historyPage, "utf8");
	assert.match(source, /import \{ isAuthed \} from "\.\.\/\.\.\/lib\/studio\/auth"/u);
	assert.match(source, /if \(!isAuthed\(Astro\.cookies\)\)[\s\S]*Astro\.redirect\("\/\?edit=1"\)/u);
	assert.match(source, /https:\/\/app\.asana\.com\/1\/72179045279617\/project\/1218197067961219/u);
	assert.match(source, /New — needs review/u);
	assert.match(source, /Approved — publishes to the site/u);
	assert.match(source, /target="_blank" rel="noopener noreferrer"/u);
	assert.match(source, /does not edit or publish the New Life\s+Remembers timeline yet/u);
});

test("the authenticated Studio dock exposes the protected history route", async () => {
	const source = await readFile(studioDock, "utf8");
	assert.match(source, /id="sd-history"[\s\S]*hidden/u);
	assert.match(source, /\$\("sd-history"\)\.hidden = false/u);
	assert.match(source, /\$\("sd-history"\)\.addEventListener\("click", \(\) => \{ location\.href = "\/studio\/history"; \}\)/u);
});
