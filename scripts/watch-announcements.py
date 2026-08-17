#!/usr/bin/env python3
"""Scour the ministries that publish no calendar feed.

Some ministries we want on the calendar have nothing machine-readable: Berkley
Hills and The Local Church GR both run real youth ministries, and neither
publishes an ICS feed. So we read their own pages on a schedule, pull out
anything that looks like a date or a standing rhythm, and hold it for a person
to confirm.

Nothing here reaches the site unconfirmed. Every find is written with
`confirmed: false`, and the calendar only carries what a human has said yes to.
Confirming is a one-word edit in content/watched-events.json.

    python3 scripts/watch-announcements.py            # scour and report
    python3 scripts/watch-announcements.py --quiet    # for a scheduled run

Reads  content/watched-ministries.json
Writes content/watched-events.json
"""
import json, os, re, sys, urllib.request
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WATCHLIST = os.path.join(ROOT, "content/watched-ministries.json")
OUT = os.path.join(ROOT, "content/watched-events.json")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun",
     "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}

# "August 20", "Sept. 7", "Dec 24"
DATED = re.compile(
    r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b", re.I)
# "Wednesdays 6-7:30pm", "Sunday nights at 6"
STANDING = re.compile(
    r"\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)s?\b"
    r"[^.|<>\n]{0,32}?\b(\d{1,2}(?::\d{2})?)\s*(?:-|–|to)?\s*(?:\d{1,2}(?::\d{2})?)?\s*"
    r"(am|pm|a\.m\.|p\.m\.)", re.I)
TIME = re.compile(r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b", re.I)


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(400_000).decode("utf-8", "ignore")


def visible(html):
    html = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<[^>]+>", " ", html)
    html = re.sub(r"&nbsp;?|&#\d+;", " ", html)
    html = html.replace("&amp;", "&")
    return re.sub(r"\s+", " ", html)


def resolve_year(month, day, today):
    """A page that says "August 20" means the next one, not a past one."""
    year = today.year
    try:
        when = date(year, month, day)
    except ValueError:
        return None
    if (today - when).days > 30:
        try:
            when = date(year + 1, month, day)
        except ValueError:
            return None
    return when


def scour(entry, today):
    finds = []
    wanted = [w.lower() for w in entry.get("look_for", [])]
    for url in entry["pages"]:
        try:
            text = visible(fetch(url))
        except Exception as exc:
            finds.append({"kind": "error", "source": url, "detail": type(exc).__name__})
            continue

        for m in DATED.finditer(text):
            month = MONTHS.get(m.group(1)[:3].lower())
            if not month:
                continue
            when = resolve_year(month, int(m.group(2)), today)
            if not when:
                continue
            start, end = max(0, m.start() - 90), min(len(text), m.end() + 90)
            context = text[start:end].strip()
            if wanted and not any(w in context.lower() for w in wanted):
                continue
            near = TIME.search(context)
            finds.append({
                "kind": "dated",
                "date": when.isoformat(),
                "time": near.group(0).lower().replace(" ", "") if near else None,
                "context": context[:190],
                "source": url,
            })

        for m in STANDING.finditer(text):
            start, end = max(0, m.start() - 90), min(len(text), m.end() + 90)
            context = text[start:end].strip()
            if wanted and not any(w in context.lower() for w in wanted):
                continue
            finds.append({
                "kind": "standing",
                "rhythm": re.sub(r"\s+", " ", m.group(0)).strip(),
                "context": context[:190],
                "source": url,
            })

    # Same announcement repeated across pages is one find.
    seen, unique = set(), []
    for f in finds:
        key = (f["kind"], f.get("date"), f.get("rhythm"), (f.get("context") or "")[:60])
        if key in seen:
            continue
        seen.add(key)
        unique.append(f)
    return unique


def main():
    quiet = "--quiet" in sys.argv
    today = date.today()
    watch = json.load(open(WATCHLIST))["watched"]

    previous = {}
    if os.path.exists(OUT):
        for row in json.load(open(OUT)).get("ministries", []):
            for f in row.get("finds", []):
                previous[(row["slug"], f.get("kind"), f.get("date"), f.get("rhythm"))] = f

    out, fresh_total = [], 0
    for entry in watch:
        finds = scour(entry, today)
        for f in finds:
            key = (entry["slug"], f.get("kind"), f.get("date"), f.get("rhythm"))
            was = previous.get(key)
            # A person's yes is never thrown away by a re-run.
            f["confirmed"] = bool(was and was.get("confirmed"))
            f["firstSeen"] = (was or {}).get("firstSeen") or today.isoformat()
            if not was:
                fresh_total += 1
        out.append({
            "slug": entry["slug"], "name": entry["name"], "venue": entry["venue"],
            "note": entry.get("note"), "finds": finds,
        })

    json.dump({
        "_comment": "Found by scouring the pages of ministries that publish no feed. "
                    "Nothing here reaches the site until confirmed is true. "
                    "Refresh with scripts/watch-announcements.py.",
        "checkedOn": datetime.now().isoformat(timespec="minutes"),
        "ministries": out,
    }, open(OUT, "w"), indent="\t")
    open(OUT, "a").write("\n")

    if quiet:
        print(f"watched {len(watch)} ministries, {fresh_total} new since last run")
        return

    print(f"Scoured {len(watch)} ministries on {today.isoformat()}. "
          f"{fresh_total} new since the last run.\n")
    for row in out:
        pending = [f for f in row["finds"] if not f.get("confirmed") and f["kind"] != "error"]
        confirmed = [f for f in row["finds"] if f.get("confirmed")]
        print(f"{row['name']} — at {row['venue']}")
        print(f"   {len(confirmed)} confirmed, {len(pending)} waiting on a person")
        for f in row["finds"][:8]:
            if f["kind"] == "error":
                print(f"     !  could not read {f['source']} ({f['detail']})")
            elif f["kind"] == "dated":
                mark = "OK" if f["confirmed"] else "??"
                print(f"     {mark} {f['date']} {f.get('time') or '':>7}  {f['context'][:70]}")
            else:
                mark = "OK" if f["confirmed"] else "??"
                print(f"     {mark} every {f['rhythm']:<28} {f['context'][:52]}")
        print()
    print("To publish a find: set its \"confirmed\": true in content/watched-events.json")


main()
