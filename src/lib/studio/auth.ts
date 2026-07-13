// Staff passcode gate for the AI editor.
//
// Stage 1: a single shared passcode compared against the STUDIO_PASSCODE env
// var (with a dev default), stored as an httpOnly cookie once entered. This is
// a simple gate to keep the editor staff-only, not a full identity system —
// good enough while the editor only touches the fenced content fields.

import type { AstroCookies } from "astro";

const COOKIE = "studio_auth";

function passcode(): string {
	return process.env.STUDIO_PASSCODE || import.meta.env.STUDIO_PASSCODE || "newlife2026";
}

// The cookie value is derived from the passcode so it can't be guessed from
// the cookie name alone, and it invalidates automatically if the passcode changes.
function tokenFor(code: string): string {
	let h = 2166136261;
	for (let i = 0; i < code.length; i++) {
		h ^= code.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return "s" + (h >>> 0).toString(36);
}

export function checkPasscode(code: string): boolean {
	return typeof code === "string" && code.length > 0 && code === passcode();
}

export function grant(cookies: AstroCookies): void {
	cookies.set(COOKIE, tokenFor(passcode()), {
		httpOnly: true,
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
