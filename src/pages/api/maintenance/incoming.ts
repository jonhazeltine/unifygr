// Clearstream fires this the moment a resident texts the maintenance number
// (the `text.received` webhook on the Residents account).
//
// What happens to that text:
//   • it's read, to decide whether it's actually a maintenance request
//   • if it is, a task opens in that house's Asana project
//   • if NO task lands — not a request, unclear, an unknown number, or Asana
//     refused — the people on MAINTENANCE_ALERT_NUMBERS get texted, so a
//     message never disappears silently
//   • the resident gets an acknowledgement only once MAINTENANCE_AUTOREPLY is
//     turned on; until then no automatic text ever reaches a resident
//
// The endpoint is guarded by a secret in the query string, because we register
// the URL with Clearstream ourselves and nothing else should be able to post.

export const prerender = false;

import type { APIRoute } from "astro";
import { sendText } from "../../../lib/clearstream/client";
import { identifyResident, houseProject } from "../../../lib/maintenance/houses";
import { triage } from "../../../lib/maintenance/triage";
import { createFollowUpTask, asanaConfigured, AsanaError } from "../../../lib/connect/asana";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

/** Clearstream's payload shape isn't guaranteed, so read it forgivingly. */
function readPayload(body: any): { text: string; from: string } | null {
	const text = body?.text ?? body?.text_body ?? body?.message?.text ?? body?.reply?.text ?? "";
	const from =
		body?.from ??
		body?.mobile_number ??
		body?.subscriber?.mobile_number ??
		body?.contact?.mobile_number ??
		"";
	if (!String(text).trim() || !String(from).trim()) return null;
	return { text: String(text).trim(), from: String(from).trim() };
}

const alertNumbers = () =>
	(process.env.MAINTENANCE_ALERT_NUMBERS || "")
		.split(",")
		.map((n) => n.trim())
		.filter(Boolean);

/** Tell the staff watchers that something came in without becoming a task. */
async function alertStaff(lines: string[]) {
	const to = alertNumbers();
	if (!to.length) return { alerted: false, reason: "No alert numbers configured." };
	try {
		await sendText({ to, body: lines.join("\n"), header: "New Life Maintenance" }, "residents");
		return { alerted: true, to: to.length };
	} catch (err) {
		return { alerted: false, reason: err instanceof Error ? err.message : String(err) };
	}
}

export const POST: APIRoute = async ({ request, url }) => {
	const secret = process.env.MAINTENANCE_WEBHOOK_SECRET;
	if (!secret || url.searchParams.get("key") !== secret) return json({ error: "Not found." }, 404);

	const body = await request.json().catch(() => null);
	const incoming = readPayload(body);
	if (!incoming) return json({ ignored: "No text and sender in the payload." });

	const resident = await identifyResident(incoming.from).catch(() => ({
		name: null,
		mobile_number: incoming.from,
		house: null as string | null,
	}));
	const who = resident.name ?? incoming.from;
	const where = resident.house ?? "an unknown house";

	const verdict = await triage({
		text: incoming.text,
		from: incoming.from,
		house: resident.house,
	});

	// Anything we won't turn into a task goes to the staff watchers instead.
	const handOff = async (why: string) => {
		const alert = await alertStaff([
			`${who} (${where}) texted and no task was opened.`,
			`Why: ${why}`,
			`They said: "${incoming.text}"`,
		]);
		return json({ task: null, handedOff: true, why, alert });
	};

	if (verdict.needsHuman) return handOff(verdict.reason);
	if (!verdict.isRequest) return handOff(`Read as not a maintenance request — ${verdict.reason}`);
	if (!resident.house) return handOff("This number isn't on any house's resident list.");

	const project = houseProject(resident.house);
	if (!project) return handOff(`No Asana project is mapped for ${resident.house}.`);
	if (!asanaConfigured()) return handOff("Asana isn't connected on this deployment.");

	let task: { gid: string; url: string };
	try {
		task = await createFollowUpTask({
			name: verdict.title,
			notes: [
				`${who} texted the maintenance line:`,
				"",
				`"${incoming.text}"`,
				"",
				`House: ${resident.house}`,
				`Their number: ${resident.mobile_number}`,
				`How urgent: ${verdict.urgency}`,
				verdict.summary ? `\n${verdict.summary}` : "",
			].join("\n"),
			dueOn: dueDate(verdict.urgency),
			projectId: project,
		});
	} catch (err) {
		return handOff(
			`Asana refused the task: ${err instanceof AsanaError || err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Emergencies always reach a person, task or no task.
	const alert =
		verdict.urgency === "emergency"
			? await alertStaff([
					`URGENT from ${who} (${where}):`,
					`"${incoming.text}"`,
					`Task opened: ${task.url}`,
				])
			: { alerted: false, reason: "Not urgent." };

	// Acknowledging the resident stays off until it's explicitly turned on.
	if (process.env.MAINTENANCE_AUTOREPLY === "on") {
		return json({
			task,
			alert,
			text_body: "Got your message — we've logged it and someone will follow up.",
			use_default_header: true,
		});
	}
	return json({ task, alert, replied: false });
};

function dueDate(urgency: string): string {
	const days = urgency === "emergency" ? 0 : urgency === "soon" ? 2 : 7;
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}
