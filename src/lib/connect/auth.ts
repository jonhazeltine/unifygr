// Passcode gate for the Connect Card admin page.
//
// Deliberately separate from the site editor's passcode: the people who work
// connect cards should be able to read submissions without also holding the
// keys to edit live pages. Same simple shape as the editor gate — a shared
// passcode, an httpOnly cookie, no identity system.

import type { AstroCookies } from "astro";

const COOKIE = "connect_admin";

function passcode(): string {
	return (
		process.env.CONNECT_ADMIN_PASSCODE ||
		(import.meta as any).env?.CONNECT_ADMIN_PASSCODE ||
		"connect-dev"
	);
}

// Derived from the passcode so the cookie can't be forged from the name alone,
// and so changing the passcode signs everyone out.
function tokenFor(code: string): string {
	let h = 2166136261;
	for (let i = 0; i < code.length; i++) {
		h ^= code.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return "c" + (h >>> 0).toString(36);
}

/** Constant-time-ish compare so a wrong guess can't be timed character by character. */
export function checkPasscode(code: unknown): boolean {
	if (typeof code !== "string" || code.length === 0) return false;
	const expected = passcode();
	if (code.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= code.charCodeAt(i) ^ expected.charCodeAt(i);
	return diff === 0;
}

export function grant(cookies: AstroCookies): void {
	cookies.set(COOKIE, tokenFor(passcode()), {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 12, // 12 hours
	});
}

export function isAuthed(cookies: AstroCookies): boolean {
	return cookies.get(COOKIE)?.value === tokenFor(passcode());
}

export function revoke(cookies: AstroCookies): void {
	cookies.delete(COOKIE, { path: "/" });
}
