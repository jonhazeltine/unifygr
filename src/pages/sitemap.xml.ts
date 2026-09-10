import type { APIRoute } from "astro";
import {
  allFamiliesIncludingSpecialised as families,
  isListable,
  type Entry,
} from "../data/ministries";
import { runtimeDirectoryEntries } from "../lib/partners/directory";
import { externalMinistriesEnabled, readSettings } from "../lib/partners/settings";
import { pillars } from "../data/site";
import { publicPaths, sitemapXml } from "../lib/discovery";
import { publicSiteUrl } from "../lib/public-site";
import { listPages } from "../lib/studio/pages";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const pages = await listPages(locals);
  const showExternalMinistries = externalMinistriesEnabled(await readSettings(locals));
  const entries = (await runtimeDirectoryEntries(locals) as Entry[])
    .filter(isListable)
    .map((entry) => ({ slug: String(entry.slug), house: entry.house, categories: entry.categories }));
  const body = sitemapXml(
    publicSiteUrl(),
    publicPaths({ pillars, families, entries, pages, externalMinistriesEnabled: showExternalMinistries }),
  );

  return new Response(body, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      "content-type": "application/xml; charset=utf-8",
    },
  });
};
