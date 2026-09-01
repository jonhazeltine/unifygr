// Reading and writing the ministry directory's listing switches.
//
// The directory is content, not settings: it lives in content/ministries.json
// alongside everything else the site is built from, and every page that lists a
// ministry already asks isListable(). So the switch lives on the entry itself,
// as `listed`, and nothing downstream had to change.
//
// That also means a change here goes live the way any content change does — a
// commit to main and a rebuild, a minute or two — rather than instantly like a
// church switch. Different things, honestly different speeds. The panel says so.
//
// Organisations carry no events: nothing in the site reads their calendar feeds
// and most publish none. Their switch decides whether we list them at all.

import { promises as fs } from "node:fs";
import path from "node:path";
import { commitToMain } from "../studio/github";

const FILE = "content/ministries.json";

export type DirectoryOrg = {
	slug: string;
	name: string;
	summary: string;
	city: string | null;
	area: string | null;
	categories: string[];
	/** whether this entry is one someone can turn up to, or reference-only */
	offering: boolean;
	/** a human at New Life has confirmed it */
	confirmed: boolean;
	listed: boolean;
};

function filePath(): string {
	return path.join(process.cwd(), FILE);
}

async function readRaw(): Promise<string> {
	return fs.readFile(filePath(), "utf8");
}

/** True when a ministry is somewhere a person could actually go. */
function isOffering(e: any): boolean {
	return Boolean(
		e.house === "in" ||
			e.handoff ||
			e.rhythm ||
			e.address ||
			e.calendar?.format === "ics" ||
			e.calendar?.format === "watched",
	);
}

export async function readOrgs(): Promise<DirectoryOrg[]> {
	const doc = JSON.parse(await readRaw());
	return (doc.entries as any[])
		.filter((e) => e.house === "out" && e.status !== "no-details")
		.map((e) => ({
			slug: e.slug,
			name: e.name,
			summary: e.summary || "",
			city: e.city ?? null,
			area: e.area ?? null,
			categories: e.categories || [],
			offering: isOffering(e),
			confirmed: e.status === "live",
			listed: e.listed !== false,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Apply listing changes. Only entries whose value actually differs are touched,
 * and `listed: true` is written as an absent key so the file stays as it reads —
 * an entry is listed unless we have said otherwise.
 */
export async function writeOrgs(changes: Record<string, boolean>): Promise<number> {
	const raw = await readRaw();
	const doc = JSON.parse(raw);
	let touched = 0;
	for (const entry of doc.entries as any[]) {
		if (!(entry.slug in changes)) continue;
		const want = changes[entry.slug];
		const now = entry.listed !== false;
		if (want === now) continue;
		if (want) delete entry.listed;
		else entry.listed = false;
		touched++;
	}
	if (!touched) return 0;

	const body = JSON.stringify(doc, null, "\t") + "\n";
	if (process.env.GITHUB_TOKEN) {
		await commitToMain(
			[{ path: FILE, content: body }],
			`content(ministries): ${touched} listing ${touched === 1 ? "change" : "changes"} from the partners panel`,
		);
	} else {
		await fs.writeFile(filePath(), body, "utf8");
	}
	return touched;
}
