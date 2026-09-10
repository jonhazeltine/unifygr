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

test("uses New Life as the default public host and keeps explicitly staged previews local", () => {
	assert.equal(finalDomainActive(), true);
	assert.equal(
		redirectForRequest(new Request("https://unifygr.com/about-us/our-staff?x=1")),
		"https://newlifegr.com/staff?x=1",
	);
	assert.equal(
		redirectForRequest(new Request("https://unifygr.com/unknown?x=1")),
		"https://newlifegr.com/unknown?x=1",
	);
	assert.equal(
		redirectForRequest(new Request("https://unifygr.com/about-us/our-staff?x=1"), "https://unifygr.com"),
		"https://unifygr.com/staff?x=1",
	);
});

test("redirects old paths to the final host only when PUBLIC_SITE_URL is final", () => {
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

test("maps legacy paths on the final host and canonicalises www without a loop", () => {
	assert.equal(
		redirectForRequest(new Request("https://newlifegr.com/about-us/our-staff?x=1"), "https://newlifegr.com"),
		"https://newlifegr.com/staff?x=1",
	);
	assert.equal(
		redirectForRequest(new Request("https://newlifegr.com/staff?x=1"), "https://newlifegr.com"),
		null,
	);
	assert.equal(
		redirectForRequest(new Request("https://www.newlifegr.com/staff?x=1"), "https://newlifegr.com"),
		"https://newlifegr.com/staff?x=1",
	);
});

test("uses an incoming fragment safely when one is present", () => {
	assert.equal(
		redirectForRequest(
			new Request("https://newlifegr.com/home/when-where?source=old#arrive"),
			"https://newlifegr.com",
		),
		"https://newlifegr.com/sunday?source=old#arrive",
	);
});

test("keeps old-host API callbacks local while redirecting human pages", () => {
	assert.equal(
		redirectForRequest(new Request("https://unifygr.com/api/maintenance/incoming"), "https://newlifegr.com"),
		null,
	);
	assert.equal(
		redirectForRequest(new Request("https://unifygr.com/about"), "https://newlifegr.com"),
		"https://newlifegr.com/about",
	);
});


test("identity paths do not redirect to themselves on production or local previews", () => {
 for (const origin of ["https://unifygr.com", "http://127.0.0.1:4324", "http://localhost:4324", "https://preview.workers.dev"]) {
  for (const path of ["/", "/giving", "/watch"]) {
   assert.equal(redirectForRequest(new Request(origin + path), "https://unifygr.com"), null);
  }
 }
});

test("local legacy paths preserve protocol and port even with the final domain configured", () => {
 for (const site of ["https://unifygr.com", "https://newlifegr.com"]) {
  assert.equal(redirectForRequest(new Request("http://127.0.0.1:4324/home?x=1"), site), "http://127.0.0.1:4324/?x=1");
 }
});
