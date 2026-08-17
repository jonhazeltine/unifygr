# How we can actually read each church

Profiled 18 churches — the ones New Life has prayed for, plus DCC, Fourth and
Mosaic Life. The question was not "do they have a calendar" but "what is the
best thing we can read, and by what technique". Five routes came out of it.

Run it again with `scripts/curation/` when the candidate list changes.

## The routes, best first

| Route | Churches | What it is | Cost |
|---|---|---|---|
| **churchcenter** | 42 accounts | Closed — Planning Center's terms forbid it | not available |
| **ics** | 1 | A real calendar feed | trivial |
| **bulletin** | 3 | A weekly PDF or dated page | cheap, needs `pdftotext` |
| **events** | 2 | Dates on a page, no feed | cheap |
| **ministry** | 4 | Ministries named, no dates | cheap, no calendar value |
| **social** | 5 | Nothing on their own site | expensive, low yield |
| **no website** | 3 | Not on record | nothing to do |

### churchcenter — CLOSED ON LICENCE. Do not re-derive this.

42 nearby churches run Planning Center's Church Center, and their ministries are
readable. **We must not read them, and this section exists so that nobody works
that out again and thinks they have found something.**

Jon's hunch was right and is worth keeping: Knapp Valley publishes through
Berkley Hills. That account runs three churches — it is titled "Berkley Hills,
Frost Creek & Knapp Valley Churches" and tags its events BH / FC / KV. Anybody
can see that by opening the page, and knowing it is useful when we talk to them.

Eight of the churches we care about run Planning Center, so the thing standing
between our people and their ministries is one click that only they can make.
That ask now sits on the Curated Partnerships page with their names under it.

What we may not do is fetch it. The Church Map investigated this exact route on
26 July 2026 and closed it: `docs/plans/church-center-calendar-findings.md` in
that repo. Four clauses of Planning Center's Terms of Service bite, and one of
them forbids incorporating their content into a directory-style product at all,
however the content was obtained. Their robots.txt also disallows ClaudeBot and
anthropic-ai by name.

I re-derived the method here without checking, and I was wrong twice over. I
reported it as "no login, no browser", which was not true in the way that
matters: it only worked because the script sent a Chrome User-Agent to a
firewall that refuses non-browser clients. And I read the resulting 403 as rate
limiting and made the client politer, when the 403 was the answer.

**The legitimate route is the church saying yes** — one registered OAuth app,
`calendar` scope, the church clicks Authorize. The Church Map is scoping that,
and our feed comes from there. For the churches we are actually in partnership
with, asking them to authorize is a conversation, not an integration.

### ics — Crossroads Bible Church
Feed linked from the homepage. Already flowing into our calendar.

### bulletin — Fourth Reformed, City Life, Providence Reformed
The richest seam, and the one nobody would find by looking for a calendar.

Fourth Reformed publishes a **PDF every week** at `/publications/`. Fifteen are
listed; the newest is dated four days ago. Inside it:

> Tuesday 10:00 AM Women's Bible Study in the Fireside room
> Wednesday 6:30 AM Dude's Group — New Beginnings, Michigan St

Two recurring ministries with day, time and room, in a file no scraper looks at.
`pdftotext -layout` reads it cleanly. Providence Reformed does the same thing at
dated URLs (`/news/bulletin-july-19-2026`). City Life uses a combined
events-and-announcements page.

**This is the technique worth building.** A small church that would never
maintain a calendar system will still produce a bulletin every single week,
because the congregation needs one.

### events — Buck Creek, DCC
Dates on the homepage, no feed. Readable, but thin and inconsistently updated.
DCC's dedicated events page renders its heading and nothing beneath it.

### ministry — Faith Church, Indwelling, New City, North Park
Substantial pages naming what they run — New City lists Worship, City Groups,
Corporate Prayer, Nursery, Serving — with no dates anywhere. Useful for knowing
what a church offers, useless for a calendar. These become curated ministries
with a standing rhythm at best, never live dates.

### social — Berean, Bethlehem, Knapp Valley, Tabernacle, and us
Nothing on their own site. Findings on Facebook specifically:

- **Plain HTTP is blocked.** Every request returns 400. It needs a real browser.
- **A headless browser reads it fine**, no login wall, on the public page and
  the events tab.
- **But the events are historic.** Knapp Valley's newest is Christmas 2025;
  Berean's is December 2024. Neither uses Facebook Events for anything recurring.
- **Much of what is there belongs to somebody else.** Berean's listings include a
  funeral home's remembrance service and the neighbourhood association's dumpster
  day — building rentals, the same noise we already strip out of calendar feeds.
- **Posts are current but unstructured.** Tabernacle posted a day ago, and it is
  a livestream announcement, not a schedule.

**Conclusion: Facebook is not worth automating for this.** It costs a browser,
yields mostly past one-offs, and mixes in other organisations' events. Worth a
person's glance when we are deciding whether to partner, not worth a job.

### no website on record — Crosswinds, Monroe, Mosaic Life
Nothing to read because The Church Map holds no website for them. Mosaic Life
sits at our own address and does have a site (themosaiclife.org); the record is
simply missing it. That is a Church Map fix, not an extraction problem.

## What Railway has to be able to do

Only three techniques earn their place:

1. **Fetch an ICS feed.** Plain HTTP.
2. **Fetch a bulletin and read a PDF.** Plain HTTP plus `poppler-utils` for
   `pdftotext`. Needs to find the newest bulletin, not just any.
3. **Fetch a page and pull dates and standing rhythms.** Plain HTTP.

All three are plain Python and one system package. **No browser required**, which
keeps the job small and cheap — that only changes if we ever decide Facebook is
worth it, and today it is not.

Everything found still lands in `content/watched-events.json` with
`confirmed: false`. The point of automating the fetch is not to publish faster;
it is so a person only ever has to say yes or no.
