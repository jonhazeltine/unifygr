// Delivering one submission to CCB and to Asana.
//
// Each selected interest gets its own Asana action. CCB receives one person
// record and, where a live queue exists, one entry per distinct queue. That
// keeps a multi-select card useful without duplicating shared destinations.

import { addToQueue, createPerson, findPerson, personUrl, updatePerson } from "./ccb";
import { asanaConfigured, createFollowUpTask } from "./asana";
import { addToServingWorkflow, pcoConfigured } from "./planningcenter";
import { DEFAULT_INTEREST, interestById, type Interest } from "./routing";
import type { Delivery, Submission } from "./store";

function dueDate(days: number, from = new Date()): string {
	const d = new Date(from);
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

/** Read both new multi-select cards and the single-select records already saved. */
export function selectedInterests(s: Submission): Interest[] {
	const ids = s.interests?.length ? s.interests : [s.interest];
	const found = ids.map(interestById).filter((interest): interest is Interest => Boolean(interest));
	return found.length ? [...new Map(found.map((interest) => [interest.id, interest])).values()] : [DEFAULT_INTEREST];
}

/** The submission written out as plain text, for the CCB note and every Asana task. */
export function summarize(s: Submission): string {
	const askedFor = selectedInterests(s).map((interest) => interest.label).join("\n• ");
	const lines = [
		`${s.firstName} ${s.lastName}`.trim(),
		s.email ? `Email: ${s.email}` : "",
		s.phone ? `Phone: ${s.phone}` : "",
		s.city ? `City: ${s.city}` : "",
		"",
		`Asked for: • ${askedFor}`,
		s.message ? `\nWhat they wrote:\n${s.message}` : "",
		s.source ? `\nHow they heard about us: ${s.source}` : "",
		"",
		`Submitted ${new Date(s.receivedAt).toLocaleString("en-US", { timeZone: "America/Detroit" })} via the Connect Card on newlifegr.com.`,
	];
	return lines.filter((line) => line !== "").join("\n");
}

/** Create or update the person in CCB and add every distinct live queue once. */
export async function deliverToCcb(s: Submission): Promise<Submission["ccb"]> {
	try {
		const fields = {
			first_name: s.firstName,
			last_name: s.lastName,
			email: s.email,
			mobile_phone: s.phone,
			city: s.city,
		};
		const existing = await findPerson(s.email, s.phone);
		const person = existing ? await updatePerson(existing.id, fields) : await createPerson(fields);
		const selected = selectedInterests(s);
		const queues = [...new Map(selected.filter((interest) => interest.queueId).map((interest) => [interest.queueId!, interest])).values()];
		const queueState = s.ccbQueues ?? {};
		for (const interest of queues) {
			const key = String(interest.queueId);
			if (queueState[key]?.status === "ok") continue;
			try {
				await addToQueue(person.id, interest.queueId!, summarize(s));
				queueState[key] = { status: "ok", detail: `Added to ${interest.process}.`, at: new Date().toISOString() };
			} catch (err) {
				queueState[key] = { status: "failed", detail: err instanceof Error ? err.message : "Unknown error", at: new Date().toISOString() };
			}
		}
		if (s.ccbQueues) s.ccbQueues = queueState;
		const queueFailures = Object.values(queueState).filter((delivery) => delivery.status === "failed");
		const landed = queues.length
			? ` Added them to ${queues.map((interest) => interest.process).filter((value, index, all) => all.indexOf(value) === index).join(" and ")}.`
			: "";
		return {
			status: queueFailures.length ? "failed" : "ok",
			ref: String(person.id),
			url: personUrl(person.id),
			detail: queueFailures.length ? `${queueFailures.length} CCB queue ${queueFailures.length === 1 ? "needs" : "need"} attention.` : (existing ? `Matched the existing profile for ${person.name}.${landed}` : `Created ${person.name}.${landed}`),
			at: new Date().toISOString(),
		};
	} catch (err) {
		return { status: "failed", detail: err instanceof Error ? err.message : "Unknown error", at: new Date().toISOString() };
	}
}

/**
 * Put a serving sign-up on the Planning Center workflow.
 * A multi-select card may have several serving choices, but it still opens only
 * one workflow card for the person.
 */
export async function deliverToPlanningCenter(s: Submission): Promise<Submission["planningCenter"]> {
	if (!selectedInterests(s).some((interest) => interest.serving)) {
		return { status: "skipped", detail: "Not a serving sign-up.", at: new Date().toISOString() };
	}
	if (!pcoConfigured()) return { status: "pending", detail: "Planning Center isn't connected on this deployment yet. This will send as soon as it is.", at: new Date().toISOString() };
	try {
		const card = await addToServingWorkflow({ firstName: s.firstName, lastName: s.lastName, email: s.email });
		return {
			status: "ok", ref: card.cardId,
			url: `https://people.planningcenteronline.com/workflows/${process.env.PCO_SERVING_WORKFLOW_ID}`,
			detail: card.matched ? "Added to Serving Interest on their existing Planning Center profile." : "Created a Planning Center profile and added them to Serving Interest.",
			at: new Date().toISOString(),
		};
	} catch (err) {
		return { status: "failed", detail: err instanceof Error ? err.message : "Unknown error", at: new Date().toISOString() };
	}
}

function aggregate(deliveries: Delivery[]): Delivery {
	if (!deliveries.length) return { status: "pending", detail: "No follow-up selected." };
	const failed = deliveries.filter((delivery) => delivery.status === "failed");
	const pending = deliveries.filter((delivery) => delivery.status === "pending");
	const status = failed.length ? "failed" : pending.length ? "pending" : "ok";
	return {
		status,
		detail: status === "ok" ? `${deliveries.length} follow-up ${deliveries.length === 1 ? "task" : "tasks"} created.` : `${failed.length || pending.length} follow-up ${failed.length || pending.length === 1 ? "needs" : "need"} attention.`,
		at: new Date().toISOString(),
	};
}

/** Create one staff task per selected interest, retrying only unfinished choices. */
export async function deliverToAsana(s: Submission, onlyInterestId?: string): Promise<Submission["asana"]> {
	if (!asanaConfigured()) {
		const pending: Delivery = { status: "pending", detail: "Asana isn't connected yet — no access token has been set. This will send as soon as it is.", at: new Date().toISOString() };
		for (const route of s.routes ?? []) if (!onlyInterestId || route.interest === onlyInterestId) route.asana = pending;
		return pending;
	}

	const routes = s.routes ?? selectedInterests(s).map((interest) => ({ interest: interest.id, interestLabel: interest.label, asana: s.asana }));
	for (const route of routes) {
		if (onlyInterestId && route.interest !== onlyInterestId) continue;
		if (route.asana.status === "ok") continue;
		const interest = interestById(route.interest) ?? DEFAULT_INTEREST;
		const who = `${s.firstName} ${s.lastName}`.trim();
		const handoff = interest.serving
			? ["", "MOVING THIS CARD", 'Drag to "Ready to serve" and they go onto the Serving Interest workflow in Planning Center. Nothing happens until you do.', interest.scheduler ? `Once they're placed, that means the "${interest.scheduler.team}" team (under ${interest.scheduler.serviceType}).` : "", 'Drag to "Reached out" once a person has actually texted or called them, so we can see who is still waiting.', "", "They're already in CCB — that happened the moment they hit send. This is about what happens to them next."].filter(Boolean).join("\n")
			: ["", 'Drag to "Reached out" once a person has actually texted or called them, so we can see who is still waiting.', "They're already in CCB — that happened the moment they hit send."].join("\n");
		try {
			const task = await createFollowUpTask({ name: `${interest.action} — ${who}`, notes: summarize(s) + (s.ccb.url ? `\n\nCCB profile: ${s.ccb.url}` : "") + handoff, dueOn: dueDate(interest.dueInDays, new Date(s.receivedAt)) });
			route.asana = { status: "ok", ref: task.gid, url: task.url, detail: "Task created.", at: new Date().toISOString() };
		} catch (err) {
			route.asana = { status: "failed", detail: err instanceof Error ? err.message : "Unknown error", at: new Date().toISOString() };
		}
	}
	if (s.routes) s.asana = aggregate(s.routes.map((route) => route.asana));
	return s.asana;
}
