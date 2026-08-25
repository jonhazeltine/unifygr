// Where Connect Card submissions are kept.
//
// Vercel Blob, PRIVATE access — these records carry names, phone numbers and
// prayer requests, so nothing here is readable from a URL. Only the server,
// holding the store token, can read them back for the admin page.
//
// CCB and Asana are the real destinations; this log exists so staff can see
// what arrived and so anything that failed on the way can be retried.

import { put, list, get } from "@vercel/blob";

const PREFIX = "connect/";

export type Delivery = {
	status: "ok" | "failed" | "pending";
	detail?: string;
	/** CCB individual id, or Asana task gid */
	ref?: string;
	url?: string;
	at?: string;
};

export type Submission = {
	id: string;
	receivedAt: string;
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	city?: string;
	interest: string;
	interestLabel: string;
	message?: string;
	/** how they heard about us / anything else the form collects */
	source?: string;
	ccb: Delivery;
	asana: Delivery;
};

function pathFor(id: string): string {
	return `${PREFIX}${id}.json`;
}

export function newId(now = new Date()): string {
	// Sortable: newest last by pathname, so listing + reverse gives newest first.
	const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
	const rand = Math.random().toString(36).slice(2, 8);
	return `${stamp}-${rand}`;
}

export async function save(submission: Submission): Promise<void> {
	await put(pathFor(submission.id), JSON.stringify(submission, null, 2), {
		access: "private",
		contentType: "application/json",
		addRandomSuffix: false,
		allowOverwrite: true,
	});
}

export async function readOne(id: string): Promise<Submission | undefined> {
	try {
		const found = await get(pathFor(id), { access: "private", useCache: false });
		if (!found) return undefined;
		const text = await new Response(found.stream).text();
		return JSON.parse(text) as Submission;
	} catch {
		return undefined;
	}
}

/** Newest first. */
export async function recent(limit = 100): Promise<Submission[]> {
	const { blobs } = await list({ prefix: PREFIX, limit: Math.min(limit, 500) });
	const paths = blobs
		.map((b) => b.pathname)
		.sort()
		.reverse()
		.slice(0, limit);
	const records = await Promise.all(
		paths.map(async (p) => {
			const id = p.slice(PREFIX.length).replace(/\.json$/, "");
			return readOne(id);
		})
	);
	return records.filter((r): r is Submission => Boolean(r));
}
