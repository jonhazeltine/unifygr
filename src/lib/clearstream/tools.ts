// The Clearstream tools staff reach through Claude, plus the guardrails.
//
// Two rules shape everything here:
//   • Sending is two-step. The first call returns a preview and a token; the
//     text only goes out when the same call comes back with that token. The
//     token is a hash of the payload, so changing a word invalidates it.
//   • Sending to a whole list is a separate permission. Looking people up and
//     reading replies is safe for anyone; texting 78 members is not.

import { createHash } from "node:crypto";
import { cs, listsFor, sendText, type Account } from "./client";

export type Permissions = { name: string; canSendToLists: boolean };

const ACCOUNT_PROP = {
	type: "string",
	enum: ["New Life", "Residents"],
	description:
		"Which account. 'New Life' (the default) is the church's own texting — congregation and ministry lists. 'Residents' is the linked account for people living in the church's houses, who text the maintenance number.",
};

const account = (v: unknown): Account =>
	String(v ?? "").toLowerCase() === "residents" ? "residents" : "church";

const token = (payload: unknown) =>
	createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 8);

function gate(payload: unknown, given: unknown, preview: Record<string, unknown>) {
	const want = token(payload);
	if (String(given ?? "").trim().toLowerCase() === want) return null;
	return {
		status: "NOT SENT — confirmation required",
		preview,
		confirm_token: want,
		next_step:
			"Show this preview in full and get an explicit yes, then call the same tool again with confirm_token set to the value above. Changing the wording or the recipients produces a new token.",
	};
}

export function toolsFor(perms: Permissions) {
	const tools: any[] = [
		{
			name: "clearstream_account",
			description:
				"The texting account at a glance: how many credits are left, how many people are reachable, and what has been going out. Check this before any send.",
			inputSchema: { type: "object", properties: { account: ACCOUNT_PROP } },
		},
		{
			name: "clearstream_lists",
			description:
				"Every texting list, with how many people on it can actually receive a text and whether it syncs itself from Church Community Builder or Planning Center.",
			inputSchema: { type: "object", properties: { account: ACCOUNT_PROP } },
		},
		{
			name: "clearstream_find_people",
			description:
				"Look someone up by name or mobile number. Shows their status and which lists they're on. Do this before adding anyone, so you don't create a duplicate.",
			inputSchema: {
				type: "object",
				properties: { account: ACCOUNT_PROP, search: { type: "string" } },
				required: ["search"],
			},
		},
		{
			name: "clearstream_add_person",
			description:
				"Add someone to the texting account, or update them, and optionally put them on lists. This does not text them — it only makes them reachable.",
			inputSchema: {
				type: "object",
				properties: {
					account: ACCOUNT_PROP,
					mobile_number: { type: "string" },
					first: { type: "string" },
					last: { type: "string" },
					email: { type: "string" },
					list_ids: { type: "array", items: { type: "number" } },
				},
				required: ["mobile_number"],
			},
		},
		{
			name: "clearstream_inbox",
			description: "Incoming replies, newest first — who wrote in and whether anyone has read it.",
			inputSchema: {
				type: "object",
				properties: { account: ACCOUNT_PROP, limit: { type: "number" } },
			},
		},
		{
			name: "clearstream_read_thread",
			description: "The full back-and-forth of one conversation with a person.",
			inputSchema: {
				type: "object",
				properties: { account: ACCOUNT_PROP, thread_id: { type: "number" } },
				required: ["thread_id"],
			},
		},
		{
			name: "clearstream_send_to_people",
			description:
				"Text specific mobile numbers — a person or a handful of them. THIS REACHES REAL PHONES. Two-step: you get a preview and a token first, then call again with the token.",
			inputSchema: {
				type: "object",
				properties: {
					account: ACCOUNT_PROP,
					mobile_numbers: { type: "array", items: { type: "string" } },
					body: { type: "string" },
					confirm_token: { type: "string" },
				},
				required: ["mobile_numbers", "body"],
			},
		},
	];

	if (perms.canSendToLists) {
		tools.push({
			name: "clearstream_send_to_list",
			description:
				"Text everyone on one or more lists. THIS REACHES EVERY PHONE ON THE LIST AND SPENDS CREDITS. Two-step: preview and token first, then call again with the token.",
			inputSchema: {
				type: "object",
				properties: {
					account: ACCOUNT_PROP,
					list_ids: { type: "array", items: { type: "number" } },
					header: { type: "string" },
					body: { type: "string" },
					confirm_token: { type: "string" },
				},
				required: ["list_ids", "body"],
			},
		});
	}

	return tools;
}

const norm = (n: string) => {
	const d = String(n).replace(/[^\d+]/g, "");
	if (d.startsWith("+")) return d;
	if (d.length === 10) return `+1${d}`;
	if (d.length === 11 && d.startsWith("1")) return `+${d}`;
	return d;
};

export async function runTool(name: string, args: any, perms: Permissions): Promise<unknown> {
	const acct = account(args.account);

	switch (name) {
		case "clearstream_account": {
			const { data } = await cs<any>("/account", { account: acct });
			return {
				account: data.business,
				sending_number: data.phone,
				credits_remaining: data.credits,
				total_subscribers: data.total_subscribers,
				default_header: data.default_header,
			};
		}
		case "clearstream_lists": {
			const lists = await listsFor(acct);
			return {
				lists: lists.map((l) => ({
					id: l.id,
					name: l.name,
					can_receive_texts: l.active_sms_subscriber_count,
				})),
			};
		}
		case "clearstream_find_people": {
			const q = String(args.search).trim();
			const digits = q.replace(/[^\d]/g, "");
			const params = new URLSearchParams({ limit: String(args.limit ?? 20), operator: "or" });
			if (digits.length >= 7) params.set("filter[mobile_number]", digits);
			else params.set("filter[full_name]", q);
			const { data } = await cs<any>(`/subscribers?${params}`, { account: acct });
			return {
				found: data.length,
				people: data.map((s: any) => ({
					name: s.full_name,
					mobile_number: s.mobile_number,
					status: s.status,
					lists: (s.lists ?? []).map((l: any) => l.name),
				})),
			};
		}
		case "clearstream_add_person": {
			const body: Record<string, unknown> = { mobile_number: norm(args.mobile_number) };
			for (const f of ["first", "last", "email"]) if (args[f]) body[f] = args[f];
			if (args.list_ids?.length) body.lists = args.list_ids;
			const { data } = await cs<any>("/subscribers", { method: "POST", body, account: acct });
			return { added: true, name: data.full_name, note: "No text was sent to them." };
		}
		case "clearstream_inbox": {
			const { data } = await cs<any>(`/threads?page_size=${args.limit ?? 20}`, { account: acct });
			return {
				threads: data.map((t: any) => ({
					thread_id: t.id,
					from: t.subscriber?.first
						? `${t.subscriber.first} ${t.subscriber.last ?? ""}`.trim()
						: t.subscriber?.mobile_number,
					unread: t.unread,
					replies: t.reply_count,
					last_reply_at: t.replied_at,
				})),
			};
		}
		case "clearstream_read_thread": {
			const { data } = await cs<any>(`/threads/${args.thread_id}/replies`, { account: acct });
			return { thread_id: args.thread_id, replies: data };
		}
		case "clearstream_send_to_people": {
			const nums = (args.mobile_numbers as string[]).map(norm).sort();
			const { data: a } = await cs<any>("/account", { account: acct });
			const blocked = gate(
				{ kind: "people", account: acct, nums, body: args.body },
				args.confirm_token,
				{
					sending_to: nums,
					people_who_will_receive_this: nums.length,
					the_text_they_will_see: args.body,
					credits_remaining_now: a.credits,
					sent_by: perms.name,
				},
			);
			if (blocked) return blocked;
			await sendText({ to: nums, body: args.body }, acct);
			return { sent: true, to: nums.length };
		}
		case "clearstream_send_to_list": {
			if (!perms.canSendToLists) {
				return {
					error:
						"You don't have permission to text a whole list. Ask Jon — he can turn this on for you.",
				};
			}
			const lists = await listsFor(acct);
			const chosen = lists.filter((l) => (args.list_ids as number[]).includes(l.id));
			const missing = (args.list_ids as number[]).filter((id) => !lists.some((l) => l.id === id));
			if (missing.length) return { error: `No such list: ${missing.join(", ")}.` };
			const reach = chosen.reduce((n, l) => n + l.active_sms_subscriber_count, 0);
			const { data: a } = await cs<any>("/account", { account: acct });
			const header = args.header ?? a.default_header;

			const blocked = gate(
				{
					kind: "list",
					account: acct,
					list_ids: [...(args.list_ids as number[])].sort(),
					header,
					body: args.body,
				},
				args.confirm_token,
				{
					sending_to: chosen.map((l) => `${l.name} (${l.active_sms_subscriber_count} reachable)`),
					people_who_will_receive_this: reach,
					the_text_they_will_see: `${header}: ${args.body}`,
					credits_remaining_now: a.credits,
					credits_after: a.credits - reach,
					warning: a.credits < reach ? "NOT ENOUGH CREDITS — this will not fully send." : null,
					sent_by: perms.name,
				},
			);
			if (blocked) return blocked;

			const { data } = await cs<any>("/messages", {
				method: "POST",
				body: { lists: args.list_ids, message_header: header, message_body: args.body },
				account: acct,
			});
			return { sent: true, message_id: data.id, recipients: reach };
		}
		default:
			return { error: `Unknown tool: ${name}` };
	}
}
