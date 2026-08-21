# unifygr — AGENTS.md

Landing site for **New Life / the Unify GR vision** — a Jesus-centered, single-page
Astro site (worship / voice / mission pillars) with ambient generated video art.
PUBLIC repo (`jonhazeltine/unifygr`). The README is still the stock Astro starter
text; this file is the real orientation doc.

## Stack

- Astro 5 (MDX, sitemap, RSS integrations) + `@astrojs/cloudflare` adapter.
- Deployed as a **Cloudflare Worker** with static assets (`wrangler.json`;
  worker entry `dist/_worker.js`).
- Content today is one page: `src/pages/index.astro`, constants in
  `src/consts.ts`, styles in `src/styles/`, generated art under
  `public/art/generated/`.

## Build & deploy

- `npm run dev` — local dev at :4321.
- `npm run check` — build + typecheck + `wrangler deploy --dry-run`.
- `npm run build && npm run deploy` — ships to Cloudflare Workers via wrangler
  (machine-local: uses the Cloudflare auth on Jon's Mac).
- `.github/workflows/mirror-plan-codework.yml` is the Mirror app's dispatch
  workflow (Claude code-work runs from Mirror plans) — don't remove it.

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
