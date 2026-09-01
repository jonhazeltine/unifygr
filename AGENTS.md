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

## The calendar and the partners panel

Our calendar is assembled **at request time** from the calendars other churches
publish, and nothing about it is baked into the repo:

- **The source** is The Church Map's Grand Rapids feed
  (`src/lib/partners/churchmap.ts`), cached five minutes. Every event arrives
  already tagged with a theme and a church id.
- **The decision** is `content/ministry-partners.json`: which churches we carry,
  and which themes we take from each. Staff edit it at **`/studio/partners`**
  (Studio passcode). On the live site the saved copy lives in Vercel Blob so a
  switch takes effect on the next page view; on a laptop the committed file is
  the live copy. `src/lib/partners/settings.ts` handles both.
- **The assembly** is `src/lib/partners/calendar.ts`, consumed by
  `/ministries/calendar` and every `/ministries/<family>/<category>` page. Both
  are `prerender = false` with a 5-minute edge cache. Because they no longer
  prerender, their URLs are listed in the sitemap by hand in `astro.config.mjs`.
- **Three global switches** (housekeeping, other churches' Sunday mornings, how
  far ahead) are the ONLY thing besides the panel that can drop an event, and
  all three are visible and toggleable in the panel. Do not add a hidden rule:
  if a gathering is missing, the reason must be a switch on that screen.
- **The panel is organised kind-first.** "Where our calendar stands" lists every
  kind of gathering with three figures — what we show, what our churches offer,
  what is published nearby — and each row opens onto the churches offering it, a
  map of where they sit, and a tick per church. Ticking a church we have not
  added adds it. The church-first list below it stays, for managing partners as
  churches. Both edit the same settings and re-render together.
- **Map pins** are resolved by `src/lib/partners/locations.ts`, which reads
  `church-funnel.json` and `church-candidates.json` first — both already in the
  repo, both keyed by The Church Map's church id, and between them they cover
  most of it — then tops up from `church-locations.json` for the handful the
  events feed reaches beyond 20 miles (Holland, Grand Haven, Zeeland). Refresh
  that top-up with `scripts/refresh-church-locations.py`; it writes only what
  the other two miss. The events feed carries no coordinates, and matching
  churches by name resolves ~17 of 46 — do not try it, join on the id. The site
  holds no Church Map database credentials by design; a church with no entry is
  listed without a pin and the panel says so. Basemaps and projection are
  shared with `MinistryMap.astro`.
- `content/curation-rules.json` and `scripts/build-curated-calendar.py` are
  **history**. They were the guesswork that stood in for a person before the
  panel existed. The script now only refreshes `content/curated-events.json`,
  the offline fallback used when The Church Map is unreachable — and that
  fallback is itself filtered through the panel's current choices.

## Watch page

The "Recent Services" grid reads the YouTube channel's public RSS feed at
request time (`src/lib/youtube.ts`), edge-cached 5 minutes, so new services
appear on their own. The `sermons` list in `content/site.json` is only the
offline fallback and a place to override a video's title/tag by ID.

## CCB is the CRM. Planning Center is the scheduler.

People enter through the CRM, never through the scheduler. A Connect Card
submission creates or matches the person in **CCB**, drops them in a CCB
follow-up queue, and opens an Asana task. A human works that queue. Only after
they approve does anyone get hand-added to a **Planning Center** team, by that
team's leader, and then scheduled onto dates.

**The website must never write to Planning Center.** The API would allow it —
posting to a PCO Form creates a person and opens a workflow card — and doing so
would put someone in the scheduler who does not exist in the CRM. That is the
thing this church has deliberately avoided. Planning Center is read-only from
here: we look at rosters and plans, we never create them. (Its Services API is
read-only through our connection anyway, but the rule is the reason, not the
limitation.)

As of 2026-09-01 Planning Center has **no Forms and no Workflows at all** —
every approval queue lives in CCB. Don't propose moving approvals to Planning
Center without saying that out loud first.

The weak link is the hand-add after approval, so `Interest.scheduler` in
`src/lib/connect/routing.ts` names the Planning Center team each interest ends
up on, and the Asana task spells the step out.

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
