import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { AstroCookies } from "astro";
import { checkPasscode, grant, isAuthed, revoke } from "../src/lib/connect/auth.ts";

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

const originalPasscode = process.env.CONNECT_ADMIN_PASSCODE;
const originalNodeEnv = process.env.NODE_ENV;
const originalDateNow = Date.now;

afterEach(() => {
	if (originalPasscode === undefined) Reflect.deleteProperty(process.env, "CONNECT_ADMIN_PASSCODE");
	else process.env.CONNECT_ADMIN_PASSCODE = originalPasscode;
	if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
	else process.env.NODE_ENV = originalNodeEnv;
	Date.now = originalDateNow;
});

describe("Connect admin authentication", () => {
	it("fails closed when CONNECT_ADMIN_PASSCODE is absent", () => {
		Reflect.deleteProperty(process.env, "CONNECT_ADMIN_PASSCODE");
		const cookies = new Cookies();

		assert.equal(checkPasscode("anything"), false);
		grant(cookies as unknown as AstroCookies);
		assert.equal(cookies.value, undefined);
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);

		process.env.CONNECT_ADMIN_PASSCODE = "";
		assert.equal(checkPasscode("anything"), false);
	});

	it("rejects wrong and malformed credentials", () => {
		process.env.CONNECT_ADMIN_PASSCODE = "configured-connect-test";
		const cookies = new Cookies();

		assert.equal(checkPasscode("wrong"), false);
		assert.equal(checkPasscode("configured-connect-test\0"), false);
		assert.equal(checkPasscode(null), false);
		assert.equal(checkPasscode({}), false);
		cookies.value = "v1.not-a-valid-token";
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
		cookies.value = `v1.${"0".repeat(64)}`;
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
	});

	it("accepts its own configured passcode and issued session", () => {
		process.env.CONNECT_ADMIN_PASSCODE = "configured-connect-test";
		const cookies = new Cookies();

		assert.equal(checkPasscode("configured-connect-test"), true);
		grant(cookies as unknown as AstroCookies);
		assert.match(cookies.value ?? "", /^v1\.\d+\.[0-9a-f]{32}\.[0-9a-f]{64}$/u);
		assert.equal(isAuthed(cookies as unknown as AstroCookies), true);
	});

	it("issues unique tokens and enforces signature, rotation, and time bounds", () => {
		const issuedAt = 1_800_000_000_000;
		Date.now = () => issuedAt;
		process.env.CONNECT_ADMIN_PASSCODE = "configured-connect-test";
		const cookies = new Cookies();

		grant(cookies as unknown as AstroCookies);
		const first = cookies.value!;
		grant(cookies as unknown as AstroCookies);
		assert.notEqual(cookies.value, first);

		cookies.value = first;
		assert.equal(isAuthed(cookies as unknown as AstroCookies), true);
		const parts = first.split(".");
		const alteredSignature = `${parts[3].slice(0, -1)}${parts[3].endsWith("0") ? "1" : "0"}`;
		cookies.value = [parts[0], parts[1], parts[2], alteredSignature].join(".");
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);

		cookies.value = first;
		Date.now = () => issuedAt - 1_000;
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
		Date.now = () => issuedAt + (60 * 60 * 12 + 1) * 1_000;
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);

		Date.now = () => issuedAt;
		process.env.CONNECT_ADMIN_PASSCODE = "rotated-connect-test";
		assert.equal(isAuthed(cookies as unknown as AstroCookies), false);
	});

	it("sets production cookie protections and keeps logout behavior", () => {
		process.env.CONNECT_ADMIN_PASSCODE = "configured-connect-test";
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
