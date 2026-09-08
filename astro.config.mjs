// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";

import cloudflare from "@astrojs/cloudflare";

import taxonomy from "./content/ministry-taxonomy.json" with { type: "json" };

// The ministry category pages render per request now, so their calendars are
// live. Astro's sitemap only sees prerendered routes, so they are listed here
// by hand — they are real pages and they belong in the sitemap.
const categoryUrls = taxonomy.families.flatMap((family) =>
	family.categories.map((c) => `https://unifygr.com/ministries/${family.slug}/${c.slug}`),
);

// https://astro.build/config
export default defineConfig({
	site: process.env.PUBLIC_SITE_URL ?? "https://unifygr.com",
	integrations: [mdx(), sitemap({ customPages: categoryUrls }), react()],
	adapter: cloudflare({
		// Expose Worker bindings at Astro.locals.runtime during local development,
		// matching the production request context.
		imageService: "compile",
		platformProxy: { enabled: true },
	}),
	// The Studio agent runs a build to verify its edits; don't let that build's
	// output disturb the dev server's file watcher (or its route manifest).
	vite: {
		server: { watch: { ignored: ["**/.wrangler/**", "**/dist/**", "**/.studio/**"] } },
	},
	// Clean short link for the (password-gated) land-sale update page.
	redirects: {
		"/land": "/land-sale-update-b7f2/",
		// The old "Plan a Visit" page is now /sunday — keep printed and linked
		// URLs working.
		"/visit": "/sunday",
		// Partner Churches sits with the Studio, whose passcode it shares —
		// /admin/ is the Connect Card door and has a different password.
		"/admin/partners": "/studio/partners",
		// Spiritual Formation stopped being a builder page when it started
		// reading the Formation App, so its old builder address still points home.
		"/p/spiritual-formation": "/spiritual-formation",
	},
});
