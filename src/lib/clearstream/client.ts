// Clearstream (church texting) API client.
//
// One API key reaches two linked accounts: the church's own account, and the
// "Residents" subaccount used for the people living in the church's houses.
// The subaccount is selected with an X-Account-Id header.

const API = "https://api.getclearstream.com/v1";

export type Account = "church" | "residents";

export function clearstreamConfigured(): boolean {
	return Boolean(process.env.CLEARSTREAM_API_KEY);
}

export class ClearstreamError extends Error {}

function accountId(account: Account): string | null {
	if (account === "church") return null;
	const id = process.env.CLEARSTREAM_RESIDENTS_ACCOUNT_ID;
	if (!id) throw new ClearstreamError("CLEARSTREAM_RESIDENTS_ACCOUNT_ID is not set.");
	return id;
}

export async function cs<T = any>(
	path: string,
	opts: { method?: string; body?: unknown; account?: Account } = {},
): Promise<T> {
	const key = process.env.CLEARSTREAM_API_KEY;
	if (!key) throw new ClearstreamError("Clearstream is not connected yet.");
	const id = accountId(opts.account ?? "church");

	const res = await fetch(`${API}${path}`, {
		method: opts.method ?? "GET",
		headers: {
			"X-Api-Key": key,
			Accept: "application/json",
			...(id ? { "X-Account-Id": id } : {}),
			...(opts.body ? { "Content-Type": "application/json" } : {}),
		},
		...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
	});
	const json: any = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new ClearstreamError(
			json?.error?.message ?? `Clearstream returned HTTP ${res.status} for ${path}`,
		);
	}
	return json;
}

export type CsList = {
	id: number;
	name: string;
	subscriber_count: number;
	active_sms_subscriber_count: number;
};

export type CsSubscriber = {
	id: number;
	mobile_number: string;
	status: string;
	first: string | null;
	last: string | null;
	full_name: string | null;
	email: string | null;
	lists?: { id: number; name: string }[];
};

export const listsFor = (account: Account) =>
	cs<{ data: CsList[] }>("/lists?page_size=100", { account }).then((r) => r.data);

export const subscriberByNumber = (number: string, account: Account) =>
	cs<{ data: CsSubscriber }>(`/subscribers/${encodeURIComponent(number)}`, { account })
		.then((r) => r.data)
		.catch(() => null);

/** Send a plain text to specific numbers. Returns the queued payload. */
export async function sendText(
	input: { to: string[]; body: string; header?: string },
	account: Account,
) {
	const numbers = await cs<{ data: { number: string; can_send_texts: boolean }[] }>("/numbers", {
		account,
	});
	const from = numbers.data.find((n) => n.can_send_texts)?.number;
	const body: Record<string, unknown> = { to: input.to, text_body: input.body };
	if (from) body.from = from;
	if (input.header) body.text_header = input.header;
	return cs<{ data: unknown }>("/texts", { method: "POST", body, account });
}
