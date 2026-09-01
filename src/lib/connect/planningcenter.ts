// Putting a serving sign-up into Planning Center.
//
// CCB is the CRM and Planning Center is the scheduler, so the order is fixed:
// the person is created or matched in CCB first (see ccb.ts), and only then
// does a card appear here for a leader to work. Nothing is ever added to a
// team automatically — the card is a staging area, and a person decides.
//
// The card lands on the "Serving Interest" workflow, whose steps are: connect
// with them, get their availability, the Core series on the app, then get them
// scheduled. Approving is the human's job; this only puts them in the queue.
//
// Auth is the org's app id + secret over HTTP Basic. Unset means unconfigured,
// not broken: a submission must still reach CCB and Asana.

const API = "https://api.planningcenteronline.com/people/v2";

export class PcoError extends Error {}

export function pcoConfigured(): boolean {
	return Boolean(process.env.PCO_APP_ID && process.env.PCO_SECRET && process.env.PCO_SERVING_WORKFLOW_ID);
}

function auth(): string {
	return "Basic " + Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString("base64");
}

async function call(path: string, method: "GET" | "POST", body?: unknown): Promise<any> {
	const res = await fetch(`${API}${path}`, {
		method,
		headers: { Authorization: auth(), "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		const detail = json?.errors?.[0]?.detail ?? `Planning Center returned HTTP ${res.status}`;
		throw new PcoError(detail);
	}
	return json;
}

/**
 * Find someone already in Planning Center by email, so a sign-up lands on the
 * profile that syncs from CCB rather than making a second one. Planning Center
 * only carries the people who serve, so a miss here is normal, not an error.
 */
async function findByEmail(email: string): Promise<string | null> {
	const q = new URLSearchParams({ "where[address]": email, per_page: "1" });
	const found = await call(`/emails?${q}`, "GET");
	const personId = found?.data?.[0]?.relationships?.person?.data?.id;
	return personId ? String(personId) : null;
}

async function createPerson(firstName: string, lastName: string): Promise<string> {
	const made = await call("/people", "POST", {
		data: { type: "Person", attributes: { first_name: firstName, last_name: lastName } },
	});
	return String(made.data.id);
}

export type CardResult = { personId: string; cardId: string; matched: boolean };

/** Put someone on the serving workflow. Returns which profile it landed on. */
export async function addToServingWorkflow(input: {
	firstName: string;
	lastName: string;
	email?: string;
}): Promise<CardResult> {
	if (!pcoConfigured()) throw new PcoError("Planning Center is not connected yet.");

	const existing = input.email ? await findByEmail(input.email) : null;
	const personId = existing ?? (await createPerson(input.firstName, input.lastName));

	const card = await call(`/workflows/${process.env.PCO_SERVING_WORKFLOW_ID}/cards`, "POST", {
		data: { type: "WorkflowCard", relationships: { person: { data: { type: "Person", id: personId } } } },
	});

	return { personId, cardId: String(card.data.id), matched: Boolean(existing) };
}
