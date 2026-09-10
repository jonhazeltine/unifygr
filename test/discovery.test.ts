import assert from "node:assert/strict";
import test from "node:test";

import { publicPaths, sitemapXml } from "../src/lib/discovery.ts";
import { publicSiteUrl } from "../src/lib/public-site.ts";
import { isCloudflareWorker } from "../src/lib/runtime.ts";

test("public paths include live runtime pages and exclude drafts and private routes", () => {
  const paths = publicPaths({
    pillars: [{ slug: "encounter-god" }],
    families: [{ slug: "care", categories: [{ slug: "recovery" }] }],
    entries: [{ slug: "visible" }, { slug: "hidden", listed: false }],
    pages: [
      { path: "/p/live-page", status: "live" },
      { path: "/p/draft-page", status: "draft" },
    ],
  });

  assert(paths.includes("/p/live-page"));
  assert(paths.includes("/ministries/care/recovery"));
  assert(paths.includes("/ministry/visible"));
  assert(!paths.includes("/p/draft-page"));
  assert(!paths.includes("/ministry/hidden"));
  assert(
    !paths.some(
      (path) =>
        path.startsWith("/admin") ||
        path.startsWith("/api") ||
        path.startsWith("/studio"),
    ),
  );
});

test("external-ministry routes leave the sitemap when the Studio switch is off", () => {
  const paths = publicPaths({
    pillars: [],
    families: [
      { slug: "kids", categories: [{ slug: "childrens-ministry" }] },
      { slug: "health", categories: [{ slug: "free-clinic" }] },
    ],
    entries: [
      { slug: "childrens-ministry", house: "in", categories: ["childrens-ministry"] },
      { slug: "free-clinic", house: "out", categories: ["free-clinic"] },
    ],
    pages: [],
    externalMinistriesEnabled: false,
  });

  assert(paths.includes("/ministries/kids"));
  assert(paths.includes("/ministries/kids/childrens-ministry"));
  assert(paths.includes("/ministry/childrens-ministry"));
  assert(!paths.includes("/ministries/calendar"));
  assert(!paths.includes("/ministries/partnerships"));
  assert(!paths.includes("/ministries/specialized"));
  assert(!paths.includes("/ministries/health"));
  assert(!paths.includes("/ministries/health/free-clinic"));
  assert(!paths.includes("/ministry/free-clinic"));
});

test("site origin is normalized and invalid configuration fails safely", () => {
  assert.equal(
    publicSiteUrl("https://newlifegr.com/path/"),
    "https://newlifegr.com",
  );
  assert.equal(publicSiteUrl("javascript:alert(1)"), "https://newlifegr.com");
  assert.equal(publicSiteUrl("not a URL"), "https://newlifegr.com");
});

test("sitemap uses the configured origin and escapes XML", () => {
  const xml = sitemapXml("https://newlifegr.com", ["/", "/search?q=one&two=2"]);
  assert(xml.includes("<loc>https://newlifegr.com/</loc>"));
  assert(xml.includes("https://newlifegr.com/search?q=one&amp;two=2"));
});

test("Worker-only local tools can be gated without environment guessing", () => {
  assert.equal(isCloudflareWorker("Cloudflare-Workers"), true);
  assert.equal(isCloudflareWorker("Node.js/22"), false);
  assert.equal(isCloudflareWorker(undefined), false);
});
