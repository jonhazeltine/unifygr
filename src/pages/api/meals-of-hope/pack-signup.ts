// Receives a "Volunteer to pack" sign-up from the Meals of Hope page — the
// site's own equivalent of the CCB-hosted form this replaces.
//
// CCB is the CRM, so that write is attempted first, but a CCB hiccup should
// never cost a team their table: the thing that actually reserves a spot is
// the Asana task in the Meals of Hope 2026 project, and the visitor is told
// they're saved as long as that lands. Either side can fail independently;
// both are logged so a miss is visible in the Worker logs even though this
// form has no admin retry page of its own (unlike the Connect Card).
export const prerender = false;

import type { APIRoute } from "astro";
import { parsePackSignup, packSignupSummary } from "../../../lib/meals-of-hope/pack-signup";
import { createPerson, findPerson, personUrl, updatePerson } from "../../../lib/connect/ccb";
import { createFollowUpTask } from "../../../lib/connect/asana";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

// Saturday, November 14, 2026 — the event itself (see content/pages/meals-of-hope.json).
const EVENT_DATE = "2026-11-14";

export const POST: APIRoute = async ({ request }) => {
	const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const parsed = parsePackSignup(raw);
	if (!parsed.ok) {
		// A bot gets no signal that the honeypot caught it.
		if (parsed.spam) return json({ ok: true });
		return json({ ok: false, error: parsed.error }, 400);
	}

	const { fields } = parsed;
	const summary = packSignupSummary(fields);

	let ccbNote = "";
	try {
		const existing = await findPerson(fields.email, fields.phone);
		const person = existing
			? await updatePerson(existing.id, { first_name: fields.firstName, last_name: fields.lastName, email: fields.email, mobile_phone: fields.phone })
			: await createPerson({ first_name: fields.firstName, last_name: fields.lastName, email: fields.email, mobile_phone: fields.phone });
		ccbNote = `\n\nCCB profile: ${personUrl(person.id)}`;
	} catch (err) {
		console.error("meals-of-hope pack-signup: CCB write failed", err instanceof Error ? err.message : err);
	}

	const projectId = process.env.MEALS_OF_HOPE_ASANA_PROJECT_ID;
	const sectionId = process.env.MEALS_OF_HOPE_ASANA_SECTION_ID;
	if (!process.env.ASANA_TOKEN || !projectId) {
		console.error("meals-of-hope pack-signup: Asana isn't configured for this project on this deployment.");
		return json({ ok: true });
	}

	try {
		await createFollowUpTask({
			name: `${fields.firstName} ${fields.lastName} — team of ${fields.headcount}`,
			notes: summary + ccbNote,
			dueOn: EVENT_DATE,
			projectId,
			sectionId,
		});
	} catch (err) {
		console.error("meals-of-hope pack-signup: Asana task failed", err instanceof Error ? err.message : err);
	}

	return json({ ok: true });
};
