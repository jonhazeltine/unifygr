import type { APIRoute } from "astro";
import {
  allFamiliesIncludingSpecialised as families,
  entries,
} from "../data/ministries";
import { pillars } from "../data/site";
import { publicPaths, sitemapXml } from "../lib/discovery";
import { publicSiteUrl } from "../lib/public-site";
import { listPages } from "../lib/studio/pages";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const pages = await listPages(locals);
  const body = sitemapXml(
    publicSiteUrl(),
    publicPaths({ pillars, families, entries, pages }),
  );

  return new Response(body, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      "content-type": "application/xml; charset=utf-8",
    },
  });
};
