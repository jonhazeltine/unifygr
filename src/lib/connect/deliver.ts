// Delivering one submission to CCB and to Asana.
//
// The two legs are independent on purpose: a person should still land in CCB
// if Asana is down, and a staff task should still exist if CCB rejects the
// profile. Each leg records its own outcome, so the admin page can retry just
// the half that failed.

import { addToQueue, createPerson, findPerson, personUrl, updatePerson } from "./ccb";
import { asanaConfigured, createFollowUpTask } from "./asana";
import { DEFAULT_INTEREST, interestById } from "./routing";
import type { Submission } from "./store";

function dueDate(days: number, from = new Date()): string {
	const d = new Date(from);
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

/** The submission written out as plain text, for the CCB note and the Asana task. */
export function summarize(s: Submission): string {
	const lines = [
		`${s.firstName} ${s.lastName}`.trim(),
		s.email ? `Email: ${s.email}` : "",
		s.phone ? `Phone: ${s.phone}` : "",
		s.city ? `City: ${s.city}` : "",
		"",
		`Asked for: ${s.interestLabel}`,
		s.message ? `\nWhat they wrote:\n${s.message}` : "",
		s.source ? `\nHow they heard about us: ${s.source}` : "",
		"",
		`Submitted ${new Date(s.receivedAt).toLocaleString("en-US", { timeZone: "America/Detroit" })} via the Connect Card on unifygr.com.`,
	];
	return lines.filter((l) => l !== "").join("\n");
}

/** Create or update the person in CCB and drop them into the right queue. */
export async function deliverToCcb(s: Submission): Promise<Submission["ccb"]> {
	try {
		const interest = interestById(s.interest) ?? DEFAULT_INTEREST;
		const fields = {
			first_name: s.firstName,
			last_name: s.lastName,
			email: s.email,
			mobile_phone: s.phone,
			city: s.city,
		};

		const existing = await findPerson(s.email, s.phone);
		const person = existing
			? await updatePerson(existing.id, fields)
			: await createPerson(fields);

		await addToQueue(person.id, interest.queueId, summarize(s));

		return {
			status: "ok",
			ref: String(person.id),
			url: personUrl(person.id),
			detail: existing
				? `Matched the existing profile for ${person.name} and added them to ${interest.process}.`
				: `Created ${person.name} and added them to ${interest.process}.`,
			at: new Date().toISOString(),
		};
	} catch (err) {
		return {
			status: "failed",
			detail: err instanceof Error ? err.message : "Unknown error",
			at: new Date().toISOString(),
		};
	}
}

/** Create the staff follow-up task in Asana. */
export async function deliverToAsana(s: Submission): Promise<Submission["asana"]> {
	if (!asanaConfigured()) {
		return {
			status: "pending",
			detail: "Asana isn't connected yet — no access token has been set. This will send as soon as it is.",
			at: new Date().toISOString(),
		};
	}
	try {
		const interest = interestById(s.interest) ?? DEFAULT_INTEREST;
		const who = `${s.firstName} ${s.lastName}`.trim();
		// The task spells out the whole path, because the second half of it — the
		// hand-add into Planning Center — is the step that gets forgotten.
		const handoff = interest.scheduler
			? [
					"",
					"WHEN YOU'VE APPROVED THEM",
					`Add them to the "${interest.scheduler.team}" team in Planning Center (under ${interest.scheduler.serviceType}), then schedule them onto a date.`,
					"CCB is the CRM and Planning Center is the scheduler, so this only happens in that order — nobody gets added to a team who hasn't come through here first.",
				].join("\n")
			: "";

		const task = await createFollowUpTask({
			name: `${interest.action} — ${who}`,
			notes: summarize(s) + (s.ccb.url ? `\n\nCCB profile: ${s.ccb.url}` : "") + handoff,
			dueOn: dueDate(interest.dueInDays, new Date(s.receivedAt)),
		});
		return { status: "ok", ref: task.gid, url: task.url, detail: "Task created.", at: new Date().toISOString() };
	} catch (err) {
		return {
			status: "failed",
			detail: err instanceof Error ? err.message : "Unknown error",
			at: new Date().toISOString(),
		};
	}
}
