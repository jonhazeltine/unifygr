import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { AstroCookies } from "astro";
import { checkPasscode, grant, isAuthed, revoke } from "../src/lib/studio/auth.ts";
import { isAuthed as isConnectAuthed } from "../src/lib/connect/auth.ts";

type CookieOptions = Parameters<AstroCookies["set"]>[2];

class Cookies {
	value: string | undefined;
	options: CookieOptions | undefined;
	deleted = false;

	get() {
		return this.value === undefined ? undefined : { value: this.value };
	}

	set(_key: string, value: string, options?: CookieOptions) {
		this.value = value;
		this.options = options;
	}

	delete() {
		this.deleted = true;
		this.value = undefined;
	}
}

const originalPasscode = process.env.STUDIO_PASSCODE;
const originalConnectPasscode = process.env.CONNECT_ADMIN_PASSCODE;
const originalNodeEnv = process.env.NODE_ENV;
const originalDateNow = Date.now;

afterEach(() => {
	if (originalPasscode === undefined) Reflect.deleteProperty(process.env, "STUDIO_PASSCODE");
	else process.env.STUDIO_PASSCODE = originalPasscode;
	if (originalConnectPasscode === undefined) Reflect.deleteProperty(process.env, "CONNECT_ADMIN_PASSCODE");
	else process.env.CONNECT_ADMIN_PASSCODE = originalConnectPasscode;
	if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
	else process.env.NODE_ENV = originalNodeEnv;
	Date.now = originalDateNow;
});

describe("Studio authentication", () => {
	it("fails closed when STUDIO_PASSCODE is absent", () => {
		Reflect.deleteProperty(process.env, "STUDIO_PASSCODE");
		const cookies = new Cookies();

		assert.equal(checkPasscode("anything"), false);
		grant(cookies as unknown as AstroCookies);
		assert.equal(cookies.value, undefined);
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);

		process.env.STUDIO_PASSCODE = "";
		assert.equal(checkPasscode("anything"), false);
	});

	it("rejects wrong and malformed credentials", () => {
		process.env.STUDIO_PASSCODE = "configured-for-test";
		const cookies = new Cookies();

		assert.equal(checkPasscode("wrong"), false);
		assert.equal(checkPasscode("configured-for-test\0"), false);
		assert.equal(checkPasscode(null), false);
		assert.equal(checkPasscode({}), false);
		cookies.value = "v1.not-a-valid-token";
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
		cookies.value = `v1.${"0".repeat(64)}`;
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
	});

	it("accepts the configured passcode and recognizes its issued session", () => {
		process.env.STUDIO_PASSCODE = "configured-for-test";
		const cookies = new Cookies();

		assert.equal(checkPasscode("configured-for-test"), true);
		grant(cookies as unknown as AstroCookies);
		assert.match(cookies.value ?? "", /^v1\.\d+\.[0-9a-f]{32}\.[0-9a-f]{64}$/u);
		assert.equal(isAuthed(cookies as unknown as AstroCookies), true);
	});

	it("issues unique tokens and enforces signature, role, rotation, and time bounds", () => {
		const issuedAt = 1_800_000_000_000;
		Date.now = () => issuedAt;
		process.env.STUDIO_PASSCODE = "shared-test-passcode";
		process.env.CONNECT_ADMIN_PASSCODE = "shared-test-passcode";
		const cookies = new Cookies();

		grant(cookies as unknown as AstroCookies);
		const first = cookies.value!;
		grant(cookies as unknown as AstroCookies);
		assert.notEqual(cookies.value, first);

		cookies.value = first;
		assert.equal(isAuthed(cookies as unknown as AstroCookies), true);
		assert.equal(isConnectAuthed(cookies as unknown as AstroCookies), false);

		const parts = first.split(".");
		cookies.value = [parts[0], String(Number(parts[1]) + 1), parts[2], parts[3]].join(".");
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
		const alteredSignature = `${parts[3].slice(0, -1)}${parts[3].endsWith("0") ? "1" : "0"}`;
		cookies.value = [parts[0], parts[1], parts[2], alteredSignature].join(".");
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);

		cookies.value = first;
		Date.now = () => issuedAt - 1_000;
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
		Date.now = () => issuedAt + (60 * 60 * 12 + 1) * 1_000;
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);

		Date.now = () => issuedAt;
		process.env.STUDIO_PASSCODE = "rotated-test-passcode";
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
	});

	it("sets production cookie protections and keeps logout behavior", () => {
		process.env.STUDIO_PASSCODE = "configured-for-test";
		process.env.NODE_ENV = "production";
		const cookies = new Cookies();

		grant(cookies as unknown as AstroCookies);
		assert.deepEqual(cookies.options, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 12,
		});

		revoke(cookies as unknown as AstroCookies);
		assert.equal(cookies.deleted, true);
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
	});
});
