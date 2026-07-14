// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
	site: "https://unifygr.com",
	integrations: [mdx(), sitemap()],
	adapter: vercel(),
	// The Studio agent runs a build to verify its edits; don't let that build's
	// output disturb the dev server's file watcher (or its route manifest).
	vite: {
		server: { watch: { ignored: ["**/.vercel/**", "**/dist/**", "**/.studio/**"] } },
	},
	// Clean short link for the (password-gated) land-sale update page.
	redirects: {
		"/land": "/land-sale-update-b7f2/",
	},
});
