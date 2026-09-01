// The board is the gate.
//
// A submission lands in CCB and on the Asana board the moment it arrives —
// recording someone costs nothing and losing their details is the one thing we
// cannot undo. But nothing HAPPENS to them until a person drags their card.
// Record everything instantly; commit nothing automatically.
//
// Asana calls this endpoint when a card moves. We look at the column it is now
// in and act on that, rather than trying to read the move out of the event —
// current state is the truth, and it makes a replayed event harmless.
//
//   Received      → nothing. Where every submission starts.
//   Ready to serve→ opens their card on the Planning Center serving workflow.
//   Reached out   → nothing yet. The hook is here for whatever comes next.
//   Done          → nothing.
//
// Asana's handshake: the first request carries X-Hook-Secret, and we must echo
// it back before any events arrive.
export const prerender = false;

import type { APIRoute } from "astro";
import { addToServingWorkflow, pcoConfigured } from "../../../lib/connect/planningcenter";
import { interestById } from "../../../lib/connect/routing";
import { recent, save, type Submission } from "../../../lib/connect/store";

const ASANA = "https://app.asana.com/api/1.0";

const ok = (body: unknown = { ok: true }) =>
	new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

async function asana(path: string, init: RequestInit = {}): Promise<any> {
	const res = await fetch(`${ASANA}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${process.env.ASANA_TOKEN}`,
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	});
	return res.json().catch(() => ({}));
}

/** Which column is this card sitting in right now? */
async function sectionOf(taskGid: string): Promise<{ gid: string; name: string } | null> {
	const task = await asana(`/tasks/${taskGid}?opt_fields=memberships.section.name,memberships.project.gid`);
	const membership = (task?.data?.memberships ?? []).find(
		(m: any) => m?.project?.gid === process.env.ASANA_PROJECT_ID,
	);
	const section = membership?.section;
	return section ? { gid: String(section.gid), name: String(section.name ?? "") } : null;
}

/** The submission behind a card. deliverToAsana stored the task gid on it. */
async function submissionFor(taskGid: string): Promise<Submission | null> {
	const all = await recent(200);
	return all.find((s) => s.asana?.ref === taskGid) ?? null;
}

async function comment(taskGid: string, text: string): Promise<void> {
	await asana(`/tasks/${taskGid}/stories`, { method: "POST", body: JSON.stringify({ data: { text } }) });
}

export const POST: APIRoute = async ({ request }) => {
	// Asana's handshake. Echo the secret and we are subscribed.
	const handshake = request.headers.get("x-hook-secret");
	if (handshake) return new Response("", { status: 200, headers: { "X-Hook-Secret": handshake } });

	const payload = (await request.json().catch(() => ({}))) as { events?: Array<{ resource?: { gid?: string } }> };
	const taskGids = [...new Set((payload.events ?? []).map((e) => e?.resource?.gid).filter(Boolean))] as string[];

	// Always answer 200: Asana disables a webhook that keeps failing, and a
	// card we could not act on is a card a human can still move again.
	for (const gid of taskGids) {
		try {
			await handleCard(gid);
		} catch (err) {
			console.error("asana-hook: could not handle task", gid, err);
		}
	}
	return ok({ ok: true, handled: taskGids.length });
};

async function handleCard(taskGid: string): Promise<void> {
	const section = await sectionOf(taskGid);
	if (section?.name !== "Ready to serve") return;

	const submission = await submissionFor(taskGid);
	if (!submission) return;

	// Dragging a card out and back must not make a second person.
	if (submission.planningCenter?.status === "ok") return;

	const interest = interestById(submission.interest);
	if (!interest?.serving) {
		await comment(taskGid, "Nothing to do here — this isn't a serving sign-up, so there's no Planning Center card to open.");
		return;
	}
	if (!pcoConfigured()) return;

	try {
		const card = await addToServingWorkflow({
			firstName: submission.firstName,
			lastName: submission.lastName,
			email: submission.email,
		});
		submission.planningCenter = {
			status: "ok",
			ref: card.cardId,
			url: `https://people.planningcenteronline.com/workflows/${process.env.PCO_SERVING_WORKFLOW_ID}`,
			detail: card.matched ? "Matched their existing Planning Center profile." : "Created a Planning Center profile.",
			at: new Date().toISOString(),
		};
		await save(submission);
		await comment(
			taskGid,
			`Done — ${submission.firstName} ${submission.lastName} is on the Serving Interest workflow in Planning Center` +
				`${card.matched ? ", on the profile they already had" : ", on a new profile"}. ` +
				`Next: get their availability, then the Core series, then schedule them.`,
		);
	} catch (err) {
		const detail = err instanceof Error ? err.message : "Unknown error";
		submission.planningCenter = { status: "failed", detail, at: new Date().toISOString() };
		await save(submission);
		await comment(taskGid, `Couldn't add them to Planning Center: ${detail}. Move the card back and forward to try again.`);
	}
}
