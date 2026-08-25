// A small CCB (Church Community Builder) client for the Connect Card.
//
// CCB's v1 API is `api.php?srv=<service>` with HTTP Basic auth and XML back.
// This is deliberately a separate, tiny client rather than a call out to the
// staff MCP connector: a form submission should not depend on a second
// service being awake.
//
// Note on parsing: most services wrap their payload in <ccb_api><response>,
// but a few (queue_list among them) hang it straight off <ccb_api>. We accept
// either shape — the shared connector does not, which is why its queue list
// errors out.

import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "_",
	textNodeName: "value",
	parseAttributeValue: false,
	parseTagValue: true,
	trimValues: true,
});

export class CcbError extends Error {}

function env(name: string): string {
	const v = process.env[name] ?? (import.meta as any).env?.[name];
	if (!v) throw new CcbError(`Missing environment variable ${name}`);
	return String(v);
}

type Params = Record<string, string | number | undefined>;

async function ccb(srv: string, opts: { query?: Params; body?: Params } = {}): Promise<any> {
	const url = new URL(env("CCB_API_URL"));
	url.searchParams.set("srv", srv);
	for (const [k, v] of Object.entries(opts.query ?? {})) {
		if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
	}

	const auth = Buffer.from(`${env("CCB_API_USER")}:${env("CCB_API_PASSWORD")}`).toString("base64");
	const init: RequestInit = { method: "GET", headers: { Authorization: `Basic ${auth}` } };

	if (opts.body) {
		const form = new URLSearchParams();
		for (const [k, v] of Object.entries(opts.body)) {
			if (v === undefined || v === null || v === "") continue;
			form.set(k, String(v));
		}
		init.method = "POST";
		init.body = form.toString();
		(init.headers as Record<string, string>)["Content-Type"] = "application/x-www-form-urlencoded";
	}

	const res = await fetch(url.toString(), init);
	const text = await res.text();
	if (!res.ok) throw new CcbError(`CCB returned HTTP ${res.status}`);
	return parse(text);
}

function parse(text: string): any {
	let doc: any;
	try {
		doc = parser.parse(text);
	} catch {
		throw new CcbError("CCB returned a response that could not be read.");
	}
	const root = doc?.ccb_api;
	if (!root) throw new CcbError("CCB returned an unexpected response.");
	const payload = root.response ?? root;
	const errors = payload?.errors?.error ?? root?.errors?.error;
	if (errors) {
		const list = asArray(errors).map((e: any) => (typeof e === "object" ? (e.value ?? "") : String(e)));
		throw new CcbError(list.filter(Boolean).join("; ") || "CCB rejected the request.");
	}
	return payload;
}

function asArray<T>(x: T | T[] | undefined | null): T[] {
	if (x === undefined || x === null) return [];
	return Array.isArray(x) ? x : [x];
}

function textOf(v: any): string | undefined {
	if (v === undefined || v === null) return undefined;
	if (typeof v === "object") return v.value !== undefined ? String(v.value) : undefined;
	const s = String(v).trim();
	return s === "" ? undefined : s;
}

export type CcbPerson = {
	id: number;
	name: string;
	email?: string;
	active?: string;
};

function simplify(ind: any): CcbPerson | undefined {
	const id = Number(ind?._id ?? ind?.individual_id);
	if (!Number.isFinite(id) || id <= 0) return undefined;
	return {
		id,
		name:
			textOf(ind.full_name) ??
			[textOf(ind.first_name), textOf(ind.last_name)].filter(Boolean).join(" "),
		email: textOf(ind.email),
		active: textOf(ind.active),
	};
}

/** Find an existing person by email, falling back to phone. */
export async function findPerson(email?: string, phone?: string): Promise<CcbPerson | undefined> {
	for (const query of [email ? { email } : undefined, phone ? { phone } : undefined]) {
		if (!query) continue;
		const res = await ccb("individual_search", { query: { ...query, max_results: 5 } });
		const hit = asArray(res?.individuals?.individual).map(simplify).find(Boolean);
		if (hit) return hit;
	}
	return undefined;
}

export type PersonFields = {
	first_name: string;
	last_name: string;
	email?: string;
	mobile_phone?: string;
	street_address?: string;
	city?: string;
	state?: string;
	zip?: string;
};

export async function createPerson(fields: PersonFields): Promise<CcbPerson> {
	const res = await ccb("create_individual", { body: fields as Params });
	const person = asArray(res?.individuals?.individual).map(simplify).find(Boolean);
	if (!person) throw new CcbError("CCB accepted the person but returned no profile.");
	return person;
}

/** Update only the fields we were given — never blank out what CCB already holds. */
export async function updatePerson(id: number, fields: Partial<PersonFields>): Promise<CcbPerson> {
	const body = Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
	const res = await ccb("update_individual", { query: { individual_id: id }, body: body as Params });
	const person = asArray(res?.individuals?.individual).map(simplify).find(Boolean);
	return person ?? { id, name: `${fields.first_name ?? ""} ${fields.last_name ?? ""}`.trim() };
}

/** Drop a person into a follow-up queue, carrying the submission as the note. */
export async function addToQueue(individualId: number, queueId: number, note: string): Promise<void> {
	await ccb("add_individual_to_queue", {
		query: { individual_id: individualId, queue_id: queueId, note: note.slice(0, 4000) },
		body: {},
	});
}

export function personUrl(id: number): string {
	const base = (process.env.CCB_API_URL ?? "").replace(/\/api\.php.*$/, "");
	return `${base}/index.php?plugin=people&fn=view&individual_id=${id}`;
}
