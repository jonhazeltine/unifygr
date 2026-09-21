// Validation and formatting for the "Volunteer to pack" sign-up form on the
// Meals of Hope page — the site's own equivalent of the CCB-hosted form
// (https://newlife.ccbchurch.com/goto/forms/310/responses/new), which asks
// the same five things: first name, last name, email, mobile phone, and how
// many people to expect.

function clean(v: unknown, max = 400): string | undefined {
	if (typeof v !== "string") return undefined;
	const s = v.trim().replace(/\s+/g, " ");
	return s === "" ? undefined : s.slice(0, max);
}

export type PackSignupFields = {
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	headcount: number;
};

export type ParsePackSignupResult =
	| { ok: true; fields: PackSignupFields }
	| { ok: false; spam: true }
	| { ok: false; spam: false; error: string };

/** A real visitor never fills in the honeypot field — only a bot does. */
export function parsePackSignup(raw: Record<string, unknown>): ParsePackSignupResult {
	if (clean(raw.website)) return { ok: false, spam: true };

	const firstName = clean(raw.firstName, 80);
	const lastName = clean(raw.lastName, 80);
	const email = clean(raw.email, 160);
	const phone = clean(raw.phone, 40);
	const headcount = Number(clean(typeof raw.headcount === "number" ? String(raw.headcount) : raw.headcount, 10));

	if (!firstName || !lastName) return { ok: false, spam: false, error: "Please give your first and last name." };
	if (!email && !phone) return { ok: false, spam: false, error: "Please give an email or a mobile number so we can reach you." };
	if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, spam: false, error: "That email doesn't look right." };
	if (!Number.isFinite(headcount) || headcount < 1) return { ok: false, spam: false, error: "Tell us how many people to expect, including yourself." };

	return { ok: true, fields: { firstName, lastName, email, phone, headcount: Math.round(headcount) } };
}

/** The submission as plain text, for the CCB note and the Asana task. */
export function packSignupSummary(f: PackSignupFields): string {
	return [
		`${f.firstName} ${f.lastName}`.trim(),
		f.email ? `Email: ${f.email}` : "",
		f.phone ? `Phone: ${f.phone}` : "",
		`Expecting ${f.headcount} ${f.headcount === 1 ? "person" : "people"}, including themself.`,
		"",
		"Submitted via the Meals of Hope 2026 page on newlifegr.com.",
	]
		.filter(Boolean)
		.join("\n");
}
