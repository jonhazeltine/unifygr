type Slugged = { slug: string };
type Family = Slugged & { categories: Slugged[] };
type MinistryEntry = Slugged & { listed?: boolean };
type BuilderPage = { path: string; status: "draft" | "live" };

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/beliefs",
  "/connect",
  "/giving",
  "/go",
  "/meals-of-hope",
  "/membership",
  "/ministries",
  "/ministries/calendar",
  "/ministries/partnerships",
  "/ministries/specialized",
  "/mission-trips",
  "/next-steps",
  "/outreach-teams",
  "/spiritual-formation",
  "/staff",
  "/sunday",
  "/tap",
  "/unify-gr",
  "/vision-values",
  "/watch",
] as const;

export function publicPaths(input: {
  pillars: Slugged[];
  families: Family[];
  entries: MinistryEntry[];
  pages: BuilderPage[];
}): string[] {
  const paths = new Set<string>(PUBLIC_ROUTES);
  for (const pillar of input.pillars) paths.add(`/${pillar.slug}`);
  for (const family of input.families) {
    paths.add(`/ministries/${family.slug}`);
    for (const category of family.categories)
      paths.add(`/ministries/${family.slug}/${category.slug}`);
  }
  for (const entry of input.entries) {
    if (entry.listed !== false) paths.add(`/ministry/${entry.slug}`);
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
