#!/usr/bin/env python3
"""Pull the curated ministries' calendar feeds into one calendar: ours.

This is not a directory of other people's calendars. Every event that comes back
is folded into a single New Life calendar, tagged with the ministry it belongs to
and the place it meets.

    python3 scripts/build-curated-calendar.py

Writes content/curated-events.json.
"""
import json, os, re, urllib.request
from datetime import date, datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content/curated-events.json")
HORIZON_DAYS = 70
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")
WEEKDAYS = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}

# This calendar is curated, not mirrored. Two filters decide what belongs.
#
# DENY strips a church's internal housekeeping and the outside groups that rent
# its building. A weight-loss group meeting in the gym is not a ministry we are
# offering anyone.
DENY = re.compile(
    r"(^(office hours|board|staff|elders?|council|deacons?|trustee|committee|"
    r"building use|private|setup|set up|clean ?up|rehearsal|practice|maintenance|"
    r"tops\b|aa\b|al-?anon|scouts?|boy ?scouts|girl ?scouts|networkers|"
    r"senior neighbors|blood drive|voting|polling))"
    r"|(-\s*(gym|library|music room|fellowship hall|room|kitchen|nursery|chapel|"
    r"sanctuary|gymnasium|basement)\b)"
    r"|(\broom \d)", re.I)

# ALLOW keeps what a person could actually turn up to. Anything matching neither
# list is left off rather than guessed at.
ALLOW = re.compile(
    r"\b(worship|service|prayer|youth|teen|student|kids?|children|nursery|"
    r"unite|nazateens|nazkidz|awana|sunday school|bible study|small group|"
    r"life group|community group|men'?s|women'?s|young adult|communion|baptism|"
    r"outreach|potluck|conference|retreat|camp|vbs|celebration|night of worship)\b",
    re.I)


def unfold(text):
    return re.sub(r"\r?\n[ \t]", "", text)


def parse_dt(value):
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1]
    try:
        if "T" in v:
            return datetime.strptime(v[:15], "%Y%m%dT%H%M%S"), True
        return datetime.strptime(v[:8], "%Y%m%d"), False
    except ValueError:
        return None, False


def expand(start, rrule, window_start, window_end, all_day):
    """Return occurrences inside the window. Handles the rules churches use."""
    if not rrule:
        return [start] if window_start <= start.date() <= window_end else []
    parts = dict(
        p.split("=", 1) for p in rrule.split(";") if "=" in p
    )
    freq = parts.get("FREQ", "")
    interval = int(parts.get("INTERVAL", 1) or 1)
    until = None
    if parts.get("UNTIL"):
        until, _ = parse_dt(parts["UNTIL"])
    count = int(parts["COUNT"]) if parts.get("COUNT", "").isdigit() else None
    days = [WEEKDAYS[d[-2:]] for d in parts.get("BYDAY", "").split(",")
            if d and d[-2:] in WEEKDAYS]

    out, emitted = [], 0
    cur = start
    guard = 0
    while guard < 1500:
        guard += 1
        if until and cur > until:
            break
        if count is not None and emitted >= count:
            break
        if cur.date() > window_end:
            break
        if cur.date() >= window_start:
            if freq == "WEEKLY" and days:
                if cur.weekday() in days:
                    out.append(cur)
            else:
                out.append(cur)
        emitted += 1
        if freq == "DAILY":
            cur += timedelta(days=interval)
        elif freq == "WEEKLY":
            cur += timedelta(days=1 if days else 7 * interval)
        elif freq == "MONTHLY":
            month = cur.month + interval
            year = cur.year + (month - 1) // 12
            month = (month - 1) % 12 + 1
            day = min(cur.day, 28)
            cur = cur.replace(year=year, month=month, day=day)
        elif freq == "YEARLY":
            cur = cur.replace(year=cur.year + interval)
        else:
            break
    return out


def events_from(ics, window_start, window_end):
    out = []
    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", unfold(ics), re.S):
        def field(name):
            m = re.search(rf"^{name}[^:\r\n]*:(.*)$", block, re.M)
            return m.group(1).strip() if m else None

        summary = field("SUMMARY")
        dtstart = field("DTSTART")
        if not summary or not dtstart:
            continue
        if DENY.search(summary) or not ALLOW.search(summary):
            continue
        start, timed = parse_dt(dtstart)
        if not start:
            continue
        rrule = field("RRULE")
        for occ in expand(start, rrule, window_start, window_end, not timed):
            out.append({
                "title": re.sub(r"\s+", " ", summary)[:90],
                "date": occ.date().isoformat(),
                "time": occ.strftime("%-I:%M%p").lower().replace(":00", "") if timed else None,
                "sort": occ.isoformat(),
            })
    return out


STOP = {"the", "and", "for", "our", "ministry", "ministries", "group", "groups",
        "church", "night", "nights", "gathering", "team", "class", "classes"}


def tokens(text):
    return {w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 3 and w not in STOP}


def match_ministry(title, owners):
    """Attach an event to the ministry it belongs to, where the name says so.

    A building's feed carries every ministry that meets there, so "NazaTeens"
    should land on the high-school page while "Sunday School" stays general.
    """
    t = tokens(title)
    if not t:
        return None
    best, best_score = None, 0
    for o in owners:
        score = len(t & tokens(o["name"]))
        if score > best_score:
            best, best_score = o, score
    return best if best_score else None


def main():
    directory = json.load(open(os.path.join(ROOT, "content/ministries.json")))
    today = date.today()
    horizon = today + timedelta(days=HORIZON_DAYS)

    # One feed may serve several ministries at the same church; fetch it once.
    by_feed = {}
    for e in directory["entries"]:
        cal = e.get("calendar") or {}
        url = cal.get("url")
        if not url or cal.get("format") != "ics":
            continue
        by_feed.setdefault(url, []).append(e)

    events, sources = [], []
    for url, owners in by_feed.items():
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            ics = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "ignore")
        except Exception as ex:
            sources.append({"url": url, "ok": False, "error": str(ex)[:90]})
            continue
        found = events_from(ics, today, horizon)
        owner = owners[0]
        for ev in found:
            match = match_ministry(ev["title"], owners)
            ev["ministry"] = match["name"] if match else None
            ev["ministrySlug"] = match["slug"] if match else None
            ev["venue"] = owner.get("venue") or owner.get("name")
            ev["area"] = (match or owner).get("area")
            events.append(ev)
        sources.append({"url": url, "ok": True, "events": len(found),
                        "venue": owner.get("venue")})

    events.sort(key=lambda e: e["sort"])
    json.dump({
        "_comment": "New Life's own calendar, gathered from the curated ministries' feeds. "
                    "Regenerate with scripts/build-curated-calendar.py.",
        "generatedOn": today.isoformat(),
        "horizon": horizon.isoformat(),
        "sources": sources,
        "events": events,
    }, open(OUT, "w"), indent="\t")
    open(OUT, "a").write("\n")

    print(f"feeds: {len(by_feed)}  ok: {sum(1 for s in sources if s['ok'])}")
    print(f"events in the next {HORIZON_DAYS} days: {len(events)}")
    for e in events[:18]:
        print(f"   {e['date']} {str(e['time'] or ''):>8}  {e['title'][:40]:<40} {e['venue']}")


main()
