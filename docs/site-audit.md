# newlifegr.com — Site Audit & Rebuild Scope

_Captured 2026-06-28. Source: live crawl of https://newlifegr.com (currently hosted on **Clover Sites**, a hosted church-website builder)._

This is the scope-out pass before rebuilding the entire site from scratch in this Astro + Cloudflare repo. The legacy site is being shut down within a few weeks.

---

## 1. The site in one line

A simple church landing site for **New Life Grand Rapids** built on the three pillars **Encounter God · Be Transformed · Change the World**. Mostly static, low-change content. A handful of pages carry real content; the rest are empty Clover template stubs.

- **Church:** New Life Grand Rapids
- **Address:** 2777 Knapp St NE, Grand Rapids, MI 49525
- **Service:** Sundays @ 10am
- **Phone:** 616.364.7043
- **Email:** info@newlifegr.com _(see issue #1 — footer links to a different address)_
- **Text-to-give:** Text "GIVE" to 855-725-9333

---

## 2. Full sitemap (as it exists today)

```
/home                              Home (real content — hero + 4 tiles, tiles are empty)
  /home/when-where                 When & Where (real: Sunday 10a + address)
  /home/member-login               Member Login → external CCB login
/about-us
  /about-us/what-we-believe        What We Believe (REAL — 9 belief statements)
  /about-us/vision-values          Vision & Values (REAL — vision + 5 values)
  /about-us/our-staff              Our Staff (REAL — leadership + care + finance teams)
/watch                             Watch (live-stream embed, YouTube)
/get-involved                      Get Involved (EMPTY — Clover filler)
  /get-involved/membership         Membership (EMPTY — Clover filler)
  /get-involved/mission-trips      Mission Trips (REAL — DR trip, FAQ, video)
  /get-involved/unify-gr           Unify GR (EMPTY — Clover filler)
  /get-involved/spiritual-formation  Spiritual Formation (EMPTY — Clover filler)
/giving                            Giving (REAL — give online / text / mail)
  /giving/impact-fund              Impact Fund (EMPTY — Clover filler)
```

**13 routes. Only 6 carry real content:** What We Believe, Vision & Values, Our Staff, Mission Trips, Giving, and Home (partial). When & Where is a one-liner.

Full text of every page is preserved in [`docs/legacy-content/`](./legacy-content/).

---

## 3. Navigation structure

**Primary nav (top bar):** Home · About Us · Watch · Get Involved · Giving
**Utility sub-bar:** When & Where · Member Login · Connect Card

- **About Us** dropdown → What We Believe / Vision & Values / Our Staff
- **Get Involved** dropdown → Membership / Mission Trips / Unify GR / Spiritual Formation
- **Giving** dropdown → Impact Fund

**Footer (identical on every page):** "NEW LIFE GRAND RAPIDS" + address + email/phone + social icons (Facebook, Instagram, Google Map, Twitter/X).

---

## 4. Current visual design

Clean, fairly dated Clover template:
- Logo: "new life" wordmark with a leaf/clover mark, black on white.
- Black top nav bar, thin uppercase letter-spaced sans-serif.
- Hero: dark worship photo (raised hands), centered "ENCOUNTER GOD / BE TRANSFORMED / CHANGE THE WORLD," "JOIN US SUNDAYS @ 10am," red **WATCH LIVE** button.
- Home body: 4 outlined-icon tiles — FIND US · CONNECT · ABOUT US · PRAYER (all currently have placeholder body text).
- Footer: black, centered, social icons.
- Palette: black / white / dark navy, single red accent for CTAs.

Screenshots saved to scratchpad (`newlifegr-capture/shot-home.png`, `shot-vision.png`, `shot-giving.png`).

---

## 5. External integrations (these must carry over)

| Feature | Destination | Notes |
|---|---|---|
| Connect Card | `newlife.ccbchurch.com/goto/forms/156/responses/new` | Church Community Builder (CCB) form |
| Member Login | CCB | Hosted by CCB |
| Watch Live | `youtube.com/@newlifegrandrapids2177/streams` | YouTube live |
| Give Online | "CLICK HERE TO GIVE ONLINE" button (JS, destination TBD — likely CCB/Pushpay) | confirm exact URL |
| Text to give | 855-725-9333 ("GIVE") | third-party SMS giving |
| Mission Trip video | Mission of Hope embed | |
| Facebook | facebook.com/NewLifeGr | |
| Instagram | instagram.com/newlifegr | |
| Twitter/X | twitter.com/newlifegr | |
| Map | Google Maps (2777 Knapp St NE) | |

We do **not** rebuild CCB or the giving processor — we link out to them, same as today.

---

## 6. Issues found in the legacy site (fix in rebuild)

1. **Email mismatch** — footer text says `info@newlifegr.com` but the link points to `info@newlifegrandrapids.org`. Pick one.
2. **5 empty stub pages** still live and in the nav: Get Involved (parent), Membership, Unify GR, Spiritual Formation, Impact Fund — all show Clover filler text ("Type the content for this section here…"). Either fill or drop them.
3. **Home tiles empty** — FIND US / CONNECT / ABOUT US / PRAYER all show "Type content here…".
4. **Watch page** has a leftover "Section Title" placeholder.
5. **"church websites by clover"** footer credit to remove.

---

## 7. Rebuild plan (this repo)

Already in place: Astro 5 + `@astrojs/cloudflare`, sitemap, MDX, RSS. A vision-landing prototype (`src/pages/index.astro`) built around the three pillars with interactive shatter/scene effects already exists (see Mirror board "Vision Landing Page").

Proposed page set for the rebuild:
- **Home** — modernized hero (three pillars), service time, Watch Live, quick links (Find Us / Connect / Give / Prayer).
- **About** — What We Believe, Vision & Values, Our Staff (keep all real content, restructure for a modern layout).
- **Watch** — YouTube live embed + recent messages.
- **Get Involved** — keep only the live items (Mission Trips is the strong one); decide on Membership / Unify GR / Spiritual Formation.
- **Giving** — give online / text / mail, Impact Fund (if kept).
- **When & Where / Connect** — service info + Connect Card link.

### The big architectural decision: editable content for non-technical staff

You want church staff to edit the site themselves after we cut over. The main candidates:

- **Git-based visual CMS (Decap or TinaCMS)** — a `/admin` login, edits commit to the repo, Cloudflare rebuilds. Free, no extra service, content lives in the repo. TinaCMS gives live visual editing; Decap is form-based.
- **Hosted headless CMS (Sanity / Storyblok)** — best visual editing UX, a polished dashboard, but a third-party account/cost and more setup.
- **Astro Content Collections only (markdown)** — simplest for us, but editors would be hand-editing markdown — not realistic for non-technical staff.

This is the one decision I need from you before building. My lean: **TinaCMS** (visual, free, git-backed, fits Astro + Cloudflare) unless you want a fully hosted dashboard, in which case **Sanity**.

---

## 8. Open questions for Jon

1. **Editing tool** — which CMS approach above? (lean: TinaCMS)
2. **Empty pages** — drop Membership / Unify GR / Spiritual Formation / Impact Fund, or are these planned content you want stubbed in?
3. **"Unify GR"** — what is this? (repo is named `unifygr`.) Ministry, event, brand?
4. **New pieces** — you mentioned adding pieces "along the way." What's on the list? (events calendar, sermon archive, online forms, blog, small-group signup…?)
5. **Giving destination** — confirm the exact "Give Online" URL (the button is JS, not a plain link).
