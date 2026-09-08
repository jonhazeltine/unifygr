// Passcode gate for the Connect Card admin page.
//
// Deliberately separate from the site editor's passcode: the people who work
// connect cards should be able to read submissions without also holding the
// keys to edit live pages. The server derives the cookie token from this
// gate's separately configured passcode and verifies it on every request.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";

const COOKIE = "connect_admin";
const SESSION_PURPOSE = "unifygr:connect-admin-session:v1";
const SESSION_KEY_PURPOSE = "unifygr:connect-admin-session-key:v1";
const PASSCODE_PURPOSE = "unifygr:connect-admin-passcode-check:v1";
const TOKEN_PREFIX = "v1.";
const SESSION_SECONDS = 60 * 60 * 12;
const TOKEN_PATTERN = /^v1\.(\d{1,13})\.([0-9a-f]{32})\.([0-9a-f]{64})$/u;

function passcode(): string | null {
	const configured = process.env.CONNECT_ADMIN_PASSCODE;
	return typeof configured === "string" && configured.length > 0 ? configured : null;
}

function passcodeDigest(code: string): Buffer {
	return createHash("sha256").update(PASSCODE_PURPOSE).update("\0").update(code).digest();
}

function sessionKey(code: string): Buffer {
	return createHash("sha256").update(SESSION_KEY_PURPOSE).update("\0").update(code).digest();
}

function signatureFor(code: string, payload: string): Buffer {
	return createHmac("sha256", sessionKey(code)).update(SESSION_PURPOSE).update("\0").update(payload).digest();
}

function tokenFor(code: string, issuedAt: number): string {
	const payload = `${issuedAt}.${randomBytes(16).toString("hex")}`;
	return TOKEN_PREFIX + payload + "." + signatureFor(code, payload).toString("hex");
}

function validToken(value: unknown, code: string, now: number): boolean {
	if (typeof value !== "string") return false;
	const match = TOKEN_PATTERN.exec(value);
	if (!match) return false;

	const issuedAt = Number(match[1]);
	if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt > SESSION_SECONDS) return false;

	const payload = `${match[1]}.${match[2]}`;
	const supplied = Buffer.from(match[3], "hex");
	return timingSafeEqual(supplied, signatureFor(code, payload));
}

export function checkPasscode(code: unknown): boolean {
	const configured = passcode();
	if (!configured || typeof code !== "string" || code.length === 0) return false;

	return timingSafeEqual(passcodeDigest(code), passcodeDigest(configured));
}

export function grant(cookies: AstroCookies): void {
	const configured = passcode();
	if (!configured) return;

	cookies.set(COOKIE, tokenFor(configured, Math.floor(Date.now() / 1000)), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_SECONDS,
	});
}

export function isAuthed(cookies: AstroCookies): boolean {
	const configured = passcode();
	if (!configured) return false;

	return validToken(cookies.get(COOKIE)?.value, configured, Math.floor(Date.now() / 1000));
}

export function revoke(cookies: AstroCookies): void {
	cookies.delete(COOKIE, { path: "/" });
}
