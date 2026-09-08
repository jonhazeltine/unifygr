import test from "node:test";
import assert from "node:assert/strict";
import {
	finalDomainActive,
	redirectForPath,
	redirectForRequest,
} from "./domain-redirects.mjs";

test("maps every supplied Clover path to a current destination", () => {
	const expected = {
		"/": "/",
		"/about-us/our-staff": "/staff",
		"/about-us/vision-values": "/vision-values",
		"/about-us/what-we-believe": "/beliefs",
		"/get-involved": "/ministries",
		"/get-involved/church-ambassador-teams": "/ambassador-teams",
		"/get-involved/meals-of-hope-2026": "/outreach-teams",
		"/get-involved/membership": "/membership",
		"/get-involved/mission-trips": "/mission-trips",
		"/get-involved/spiritual-formation": "/spiritual-formation",
		"/giving": "/giving",
		"/giving/impact-fund": "/giving",
		"/home": "/",
		"/home/member-login": "https://newlife.ccbchurch.com/",
		"/home/when-where": "/sunday#when-where",
		"/watch": "/watch",
	};
	for (const [path, target] of Object.entries(expected)) {
		assert.equal(redirectForPath(path), target, path);
	}
});

test("preserves query strings", () => {
	assert.equal(
		redirectForPath("/get-involved/mission-trips", "?source=old-site"),
		"/mission-trips?source=old-site",
	);
});

test("keeps host redirects disabled before final activation", () => {
	assert.equal(finalDomainActive("https://unifygr.com"), false);
	assert.equal(
		redirectForRequest(new Request("https://unifygr.com/about-us/our-staff?x=1"), "https://unifygr.com"),
		null,
	);
});

test("redirects the old host only when SITE_URL is final, preserving path/query", () => {
	assert.equal(
		redirectForRequest(
			new Request("https://unifygr.com/about-us/our-staff?x=1"),
			"https://newlifegr.com",
		),
		"https://newlifegr.com/staff?x=1",
	);
	assert.equal(
		redirectForRequest(
			new Request("https://unifygr.com/home/when-where?source=old"),
			"https://newlifegr.com",
		),
		"https://newlifegr.com/sunday?source=old#when-where",
	);
});
