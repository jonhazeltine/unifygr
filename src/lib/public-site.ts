const FALLBACK_SITE_URL = "https://unifygr.com";

/** Return the one canonical site origin used by redirects, metadata, and discovery files. */
export function publicSiteUrl(value = process.env.PUBLIC_SITE_URL): string {
  try {
    const url = new URL(value || FALLBACK_SITE_URL);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      return FALLBACK_SITE_URL;
    return url.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}
