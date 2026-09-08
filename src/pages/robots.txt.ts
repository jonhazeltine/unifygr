import type { APIRoute } from "astro";
import { publicSiteUrl } from "../lib/public-site";

export const prerender = false;

export const GET: APIRoute = () => {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /api/",
    "Disallow: /studio",
    "Disallow: /uploads/",
    `Sitemap: ${publicSiteUrl()}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
};
