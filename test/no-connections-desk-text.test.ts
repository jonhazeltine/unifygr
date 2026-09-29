import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

// There is no staffed Connections desk or kids desk at New Life (Jon,
// 2026-09-29). Anywhere the site used to say "Connections desk" or "kids
// desk" it now says to look for a greeter wearing a lanyard, or points at
// the Connect card. This test guards against either phrase creeping back
// into content or source.
const ROOTS = ["content", "src"];
const BANNED = [/connections desk/i, /kids desk/i];
const SKIP_DIRS = new Set(["node_modules", ".astro", "dist"]);

function* walk(dir: string): Generator<string> {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_DIRS.has(entry.name)) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (/\.(json|ts|tsx|astro|js|mjs)$/.test(entry.name)) yield full;
	}
}

test("no 'Connections desk' or 'kids desk' anywhere in content or src", () => {
	const offenders: string[] = [];
	for (const root of ROOTS) {
		const full = path.join(process.cwd(), root);
		if (!fs.existsSync(full)) continue;
		for (const file of walk(full)) {
			const text = fs.readFileSync(file, "utf8");
			for (const pattern of BANNED) {
				if (pattern.test(text)) offenders.push(`${file} matches ${pattern}`);
			}
		}
	}
	assert.deepEqual(offenders, []);
});
