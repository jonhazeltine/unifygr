# unifygr — AGENTS.md

Site for **New Life / the Unify GR vision** — a Jesus-centered Astro site
(worship / voice / mission pillars) with ambient generated video art. PUBLIC
repo (`jonhazeltine/unifygr`). The README is still the stock Astro starter
text; this file is the real orientation doc.

## Stack

- Astro 5 (MDX, sitemap, RSS, React integrations) + `@astrojs/vercel` adapter.
- Deployed on **Vercel** at unifygr.com; every push to `main` deploys.
- Many pages now (`src/pages/`), with editable copy in `content/site.json`,
  constants in `src/data/site.ts`, styles in `src/styles/`, and generated art
  under `public/art/generated/`.
- **The Studio is the CMS** — a staff-only dock on the live site
  (`src/components/StudioDock.astro`, `src/lib/studio/`, `/api/studio/*`).
  It edits fenced fields in `content/site.json` and commits pages, nav and
  media to `main`. TinaCMS was removed 2026-08-25; don't reintroduce it.

## Build & deploy

- `npm run dev` — local dev at :4321.
- `npm run check` — build + typecheck.
- `npm run build` — what Vercel runs; merging to `main` is how the site ships.
- `.github/workflows/mirror-plan-codework.yml` is the Mirror app's dispatch
  workflow (Claude code-work runs from Mirror plans) — don't remove it.

## Watch page

The "Recent Services" grid reads the YouTube channel's public RSS feed at
request time (`src/lib/youtube.ts`), edge-cached 5 minutes, so new services
appear on their own. The `sermons` list in `content/site.json` is only the
offline fallback and a place to override a video's title/tag by ID.

## Rules

- **All imagery follows `AI_ART_DIRECTION.md`** — one visual language
  (cinematic spiritual minimalism, midnight blue/charcoal + warm gold), with
  the global negative prompt and per-scene prompts defined there. Read it
  before generating or swapping any art.
- Public repo: never commit secrets or personal data. `.env.local` is
  gitignored; keep it that way.
- Ship via feature branch → PR → squash-merge to `main` (auto-merge is
  enabled on this repo). Never commit straight to main.
- Jon is non-technical — report outcomes in plain English; never ask him to
  review code or a PR.

## Reaching the chief of staff (machine-local)

A supervising chief-of-staff session on Jon's Mac watches every project's Mirror
board, routines, and PRs. To hand it a finding outside your task: read
`~/.claude/chief-of-staff.json` and send to the `sessionId` it names
(`mcp__ccd_session_mgmt__send_message`). **Never search for it by name** — peer
names in session listings come from working directories, not titles. If it isn't
reachable, write the finding onto this project's Mirror board with a clear
recommendation instead. (No such session or file exists on a clone elsewhere.)
