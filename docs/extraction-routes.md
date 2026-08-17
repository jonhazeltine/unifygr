# How we can actually read each church

Profiled 18 churches — the ones New Life has prayed for, plus DCC, Fourth and
Mosaic Life. The question was not "do they have a calendar" but "what is the
best thing we can read, and by what technique". Five routes came out of it.

Run it again with `scripts/curation/` when the candidate list changes.

## The routes, best first

| Route | Churches | What it is | Cost |
|---|---|---|---|
| **churchcenter** | 42 accounts | Planning Center's public API | trivial, and the biggest |
| **ics** | 1 | A real calendar feed | trivial |
| **bulletin** | 3 | A weekly PDF or dated page | cheap, needs `pdftotext` |
| **events** | 2 | Dates on a page, no feed | cheap |
| **ministry** | 4 | Ministries named, no dates | cheap, no calendar value |
| **social** | 5 | Nothing on their own site | expensive, low yield |
| **no website** | 3 | Not on record | nothing to do |

### churchcenter — 42 churches, and the reason to rewrite this page

Found by following a hunch of Jon's: Knapp Valley's GIVE button points at
`berkleyhills.churchcenter.com`. It turned out to be one Planning Center account
running three churches — the page is titled "Berkley Hills, Frost Creek & Knapp
Valley Churches" — and Knapp Valley's events are in there, prefixed KV.

A Church Center page is an empty React shell that fills itself in from an API,
so fetching the HTML returns nothing and every crawler concludes the church
publishes nothing. The Church Map has 168 links into churchcenter.com from
churches inside our radius, across 44 accounts, and **every single one is filed
"unreachable"**. Nationally it holds 6,453 such rows, 11% of every calendar feed
it has ever recorded, and none of them work.

The site hands out its own key. Two calls, no login and no browser:

```
POST https://<account>.churchcenter.com/sessions/tokens   -> a bearer token
GET  https://api.churchcenter.com/groups/v2/groups        with that token
```

42 of 44 accounts answered: **229 published events and 350 public groups.**

Groups are the find. An event is a one-off; a group is a standing ministry with
its rhythm written on it in the church's own words — "Wings and Witness (Men's
group), Weekly, Tuesdays @ 5:30 p.m." 173 of them carry a real day of the week.
That includes 35 men's and 28 women's groups, which is the hole Jon flagged when
he said he could only see two.

It also corrects this page. Knapp Valley and Tabernacle were both filed under
"social — nothing on their own site." Tabernacle has 30 public groups and Knapp
Valley publishes through Berkley Hills. Neither was quiet; we were reading the
wrong door.

**Be a polite client.** Planning Center throttles hard — asking all 44 accounts
at once with ten workers earned a 403 for every one of them. `fetch-churchcenter.py`
goes one at a time with a pause and caches every answer, so a re-run costs the
churches nothing.

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

Four techniques earn their place:

1. **Ask Church Center for its groups and events.** Two plain HTTP calls per
   church, no browser, no credentials, no per-church configuration. This is the
   one that scales: 1,705 distinct Church Center accounts are already on record
   nationally, and one polite pass over all of them is about 1.4 hours
   single-threaded.
2. **Fetch an ICS feed.** Plain HTTP.
3. **Fetch a bulletin and read a PDF.** Plain HTTP plus `poppler-utils` for
   `pdftotext`. Needs to find the newest bulletin, not just any.
4. **Fetch a page and pull dates and standing rhythms.** Plain HTTP.

All four are plain Python and one system package. **No browser required**, which
keeps the job small and cheap — that only changes if we ever decide Facebook is
worth it, and today it is not.

Everything found still lands in `content/watched-events.json` with
`confirmed: false`. The point of automating the fetch is not to publish faster;
it is so a person only ever has to say yes or no.
