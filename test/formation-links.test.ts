import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ANDROID_PLAY_STORE_URL,
	FORMATION_DESKTOP_URL,
	IOS_APP_STORE_URL,
	pickFormationDestination,
} from "../src/lib/formation-links.ts";

const IPHONE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_UA =
	"Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE_UA =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const DESKTOP_MAC_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const DESKTOP_WINDOWS_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

describe("pickFormationDestination", () => {
	it("sends an iPhone to the App Store", () => {
		assert.equal(pickFormationDestination(IPHONE_UA), IOS_APP_STORE_URL);
	});

	it("sends an iPad to the App Store", () => {
		assert.equal(pickFormationDestination(IPAD_UA), IOS_APP_STORE_URL);
	});

	it("sends an Android phone to Play", () => {
		assert.equal(pickFormationDestination(ANDROID_PHONE_UA), ANDROID_PLAY_STORE_URL);
	});

	it("sends desktop Chrome on a Mac to the website", () => {
		assert.equal(pickFormationDestination(DESKTOP_MAC_UA), FORMATION_DESKTOP_URL);
	});

	it("sends desktop Chrome on Windows to the website", () => {
		assert.equal(pickFormationDestination(DESKTOP_WINDOWS_UA), FORMATION_DESKTOP_URL);
	});

	it("falls back to the website when there is no User-Agent at all", () => {
		assert.equal(pickFormationDestination(null), FORMATION_DESKTOP_URL);
		assert.equal(pickFormationDestination(undefined), FORMATION_DESKTOP_URL);
		assert.equal(pickFormationDestination(""), FORMATION_DESKTOP_URL);
	});
});
