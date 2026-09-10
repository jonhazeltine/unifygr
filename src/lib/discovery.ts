type Slugged = { slug: string };
type Family = Slugged & { categories: Slugged[] };
type MinistryEntry = Slugged & { listed?: boolean; house?: "in" | "out"; categories?: string[] };
type BuilderPage = { path: string; status: "draft" | "live" };

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/beliefs",
  "/connect",
  "/ministries",
  "/spiritual-formation",
  "/sunday",
  "/vision-values",
  "/watch",
] as const;

export function publicPaths(input: {
  pillars: Slugged[];
  families: Family[];
  entries: MinistryEntry[];
  pages: BuilderPage[];
  externalMinistriesEnabled?: boolean;
}): string[] {
  const showExternalMinistries = input.externalMinistriesEnabled !== false;
  const paths = new Set<string>(PUBLIC_ROUTES);
  if (showExternalMinistries) {
    paths.add("/ministries/calendar");
    paths.add("/ministries/partnerships");
    paths.add("/ministries/specialized");
  }
  for (const pillar of input.pillars) paths.add(`/${pillar.slug}`);
  for (const family of input.families) {
    const visibleCategories = family.categories.filter((category) =>
      showExternalMinistries || input.entries.some((entry) =>
        entry.house === "in" && entry.listed !== false && entry.categories?.includes(category.slug),
      ),
    );
    if (!showExternalMinistries && visibleCategories.length === 0) continue;
    paths.add(`/ministries/${family.slug}`);
    for (const category of visibleCategories) paths.add(`/ministries/${family.slug}/${category.slug}`);
  }
  for (const entry of input.entries) {
    if (entry.listed !== false && (showExternalMinistries || entry.house === "in")) {
      paths.add(`/ministry/${entry.slug}`);
    }
  }
  for (const page of input.pages) {
    if (page.status === "live") paths.add(page.path);
  }
  return [...paths].sort();
}

function xmlEscape(value: string): string {
  return value.replace(
    /[<>&'\"]/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[character]!,
  );
}

export function sitemapXml(origin: string, paths: string[]): string {
  const urls = paths
    .map(
      (path) =>
        `  <url><loc>${xmlEscape(new URL(path, origin).href)}</loc></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
