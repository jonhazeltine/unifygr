// Receives a Connect Card from the website.
//
// Order matters: we record the submission BEFORE attempting delivery, so a
// crash mid-delivery can never lose what someone wrote. CCB and Asana are then
// attempted in turn and the record is updated with how each one went.
export const prerender = false;

import type { APIRoute } from "astro";
import { deliverToAsana, deliverToCcb, deliverToPlanningCenter } from "../../../lib/connect/deliver";
import { DEFAULT_INTEREST, interestById } from "../../../lib/connect/routing";
import { newId, save, type Submission } from "../../../lib/connect/store";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function clean(v: unknown, max = 400): string | undefined {
	if (typeof v !== "string") return undefined;
	const s = v.trim().replace(/\s+/g, " ");
	return s === "" ? undefined : s.slice(0, max);
}

export const POST: APIRoute = async ({ request }) => {
	const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;

	// Honeypot: a real person never fills a field they cannot see. Answer as if
	// it worked so a bot gets no signal that it was caught.
	if (clean(raw.website)) return json({ ok: true });

	const firstName = clean(raw.firstName, 80);
	const lastName = clean(raw.lastName, 80);
	const email = clean(raw.email, 160);
	const phone = clean(raw.phone, 40);

	if (!firstName || !lastName) return json({ ok: false, error: "Please give your first and last name." }, 400);
	if (!email && !phone) return json({ ok: false, error: "Please give an email or a phone number so we can reach you." }, 400);
	if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "That email doesn't look right." }, 400);

	const interest = interestById(String(raw.interest ?? "")) ?? DEFAULT_INTEREST;

	const submission: Submission = {
		id: newId(),
		receivedAt: new Date().toISOString(),
		firstName,
		lastName,
		email,
		phone,
		city: clean(raw.city, 80),
		interest: interest.id,
		interestLabel: interest.label,
		message: clean(raw.message, 4000),
		source: clean(raw.source, 200),
		ccb: { status: "pending" },
		asana: { status: "pending" },
		planningCenter: { status: "pending" },
	};

	try {
		await save(submission);
	} catch (err) {
		// Nothing is recorded, so tell the truth rather than pretending it landed.
		console.error("connect: could not record submission", err);
		return json({ ok: false, error: "Something went wrong on our end. Please try again, or call the church office." }, 500);
	}

	// CCB first, always: it is the CRM, and nobody reaches the scheduler who is
	// not in it. Planning Center only ever sees people who already landed here.
	submission.ccb = await deliverToCcb(submission);
	submission.planningCenter = await deliverToPlanningCenter(submission);
	submission.asana = await deliverToAsana(submission);
	await save(submission).catch((err) => console.error("connect: could not update submission", err));

	// Whether CCB or Asana hiccuped is our problem to fix from the admin page,
	// not something to put in front of someone who just asked for prayer.
	return json({ ok: true });
};
