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
import { createFollowUpTask, AsanaError } from "../../../lib/connect/asana";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

/**
 * Clearstream wraps the event — `{ created_at, event, production, data: {...} }`
 * — and the text itself lives inside `data`. Everything is read through this,
 * so a payload that arrives either way is understood. Reading only the outer
 * object is what silently dropped every live resident text for a week.
 */
function unwrap(body: any): any {
	return body?.data && typeof body.data === "object" ? body.data : (body ?? {});
}

/** Clearstream's payload shape isn't guaranteed, so read it forgivingly. */
function readPayload(body: any): { text: string; from: string } | null {
	const d = unwrap(body);
	const text = d?.text ?? d?.text_body ?? d?.message?.text ?? d?.reply?.text ?? "";
	const from =
		d?.from ??
		d?.mobile_number ??
		d?.subscriber?.mobile_number ??
		d?.contact?.mobile_number ??
		"";
	if (!String(text).trim() || !String(from).trim()) return null;
	return { text: String(text).trim(), from: String(from).trim() };
}

/**
 * Clearstream keeps webhooks on the church's own account, so the only way to
 * see texts sent to the Residents line is to include subaccounts — which
 * means texts to the church's own number arrive here too. Those are
 * congregation replies, not maintenance, and alerting the staff watchers
 * about every one of them would bury the real ones. So anything addressed to
 * a different number than the maintenance line is left alone.
 *
 * With MAINTENANCE_LINE unset, or a payload that doesn't say which number was
 * texted, nothing is dropped — the old behaviour stands.
 */
function textedAnotherLine(body: any): string | null {
	const line = (process.env.MAINTENANCE_LINE || "").trim();
	if (!line) return null;
	const d = unwrap(body);
	const to = String(d?.number ?? d?.to ?? d?.received_on ?? "").trim();
	if (!to) return null;
	const last10 = (n: string) => n.replace(/\D/g, "").slice(-10);
	return last10(to) === last10(line) ? null : to;
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

	// Which number a text was sent to decides whether it belongs here at all,
	// and Clearstream's payload shape is not guaranteed — so record the shape
	// (never the message itself) to make a silent mis-route visible.
	console.log(
		"[maintenance] webhook hit",
		JSON.stringify({
			event: body?.event ?? null,
			keys: body && typeof body === "object" ? Object.keys(body) : null,
			innerKeys: typeof unwrap(body) === "object" ? Object.keys(unwrap(body)) : null,
			number: unwrap(body)?.number ?? null,
		}),
	);

	const otherLine = textedAnotherLine(body);
	if (otherLine) return json({ ignored: `Sent to ${otherLine}, not the maintenance line.` });

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

	const target = houseProject(resident.house);
	if (!target) return handOff(`No Asana project is mapped for ${resident.house}.`);
	// The house project stands on its own — it does not need the unrelated
	// Connect Card project to be configured, only the shared Asana token.
	if (!process.env.ASANA_TOKEN) return handOff("Asana isn't connected on this deployment.");

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
			projectId: target.project,
			sectionId: target.section ?? undefined,
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

/**
 * Due dates are counted from the date it is *in Grand Rapids*, not in UTC.
 * A text at 9pm local is already tomorrow in UTC, which would push an
 * emergency to "due tomorrow" — exactly the wrong day.
 */
function dueDate(urgency: string): string {
	const days = urgency === "emergency" ? 0 : urgency === "soon" ? 2 : 7;
	const local = new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
	const d = new Date(`${local}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}
