# How we can actually read each church

Profiled 18 churches — the ones New Life has prayed for, plus DCC, Fourth and
Mosaic Life. The question was not "do they have a calendar" but "what is the
best thing we can read, and by what technique". Five routes came out of it.

Run it again with `scripts/curation/` when the candidate list changes.

## The routes, best first

| Route | Churches | What it is | Cost |
|---|---|---|---|
| **ics** | 1 | A real calendar feed | trivial |
| **bulletin** | 3 | A weekly PDF or dated page | cheap, needs `pdftotext` |
| **events** | 2 | Dates on a page, no feed | cheap |
| **ministry** | 4 | Ministries named, no dates | cheap, no calendar value |
| **social** | 5 | Nothing on their own site | expensive, low yield |
| **no website** | 3 | Not on record | nothing to do |

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
