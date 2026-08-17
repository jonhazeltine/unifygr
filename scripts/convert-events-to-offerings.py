#!/usr/bin/env python3
"""Turn gathered events into offerings.

The funnel is already complete: every church within 20 miles, every event they
publish, filtered down by content/curation-rules.json. What is left is
mechanical — a church that runs a women's Bible study every Wednesday and has it
on our calendar should appear as an offering in that category.

This reads the curated calendar, groups it by church and category, works out
what each ministry is called and when it meets, and writes any that are missing
into content/ministries.json. Everything it adds is status "proposed", so a
person still confirms before it counts as verified.

    python3 scripts/convert-events-to-offerings.py            # show what it would add
    python3 scripts/convert-events-to-offerings.py --write    # add them
"""
import json, os, re, sys, collections
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVENTS = os.path.join(ROOT, "content/curated-events.json")
MINISTRIES = os.path.join(ROOT, "content/ministries.json")
FUNNEL = os.path.join(ROOT, "content/church-funnel.json")
RULES = os.path.join(ROOT, "content/curation-rules.json")

DAYS = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"]

# A church labels its own events for its own people. These prefixes and suffixes
# are shelving, not the ministry's name.
STRIP = [
    (re.compile(r"^(men'?s|women'?s|ladies|kids?|youth|students?|seniors?)\s*[|:–-]\s*", re.I), ""),
    (re.compile(r"\s*[|]\s*.*$"), ""),
    (re.compile(r"\s*\((?:cancelled|postponed|pending[^)]*)\)\s*", re.I), ""),
    (re.compile(r"^\*+\s*"), ""),
    (re.compile(r"\s{2,}"), " "),
]
GENERIC = re.compile(r"^(worship|service|prayer|prayer meeting|bible study|sunday school|"
                     r"small group|community group|fellowship|coffee|potluck|breakfast|dinner)$", re.I)


def clean(title):
    out = title
    for pattern, repl in STRIP:
        out = pattern.sub(repl, out)
    return out.strip(" -–|·").strip()


def rhythm_for(events):
    """Describe when it meets, from the dates we actually have.

    Returns None when there is no rhythm to describe. An offering is something
    ongoing that a person can join; a fish fry or a golf outing belongs on the
    calendar but is not a ministry.
    """
    weekdays = collections.Counter()
    times = collections.Counter()
    for e in events:
        try:
            weekdays[date.fromisoformat(e["date"]).weekday()] += 1
        except ValueError:
            continue
        if e.get("time"):
            times[e["time"]] += 1
    if not weekdays:
        return None
    day, day_n = weekdays.most_common(1)[0]
    if day_n < 2:
        return None
    label = DAYS[day]
    if times:
        time, time_n = times.most_common(1)[0]
        if time_n >= 2:
            return f"{label}, {time}"
    return label


def summary_for(name, venue, theme_label, events):
    when = rhythm_for(events)
    when_bit = f" {when.lower()}" if when and "check the calendar" not in when.lower() else ""
    return f"{theme_label} at {venue}, meeting{when_bit}.".replace("meeting.", "meeting regularly.")


def main():
    write = "--write" in sys.argv
    cal = json.load(open(EVENTS))
    directory = json.load(open(MINISTRIES))
    funnel = {c["name"]: c for c in json.load(open(FUNNEL))["churches"]}
    # Our own campus is already listed as Signature Ministries; nothing there
    # should ever be written back in as a curated one.
    ours = {c.lower() for c in json.load(open(RULES))["knappsCorner"]["churches"]}

    entries = directory["entries"]
    have = collections.defaultdict(set)
    for e in entries:
        venue = e.get("venue") or e["name"]
        for c in e["categories"]:
            have[c].add(venue)
    known_slugs = {e["slug"] for e in entries}

    # Group the calendar by church and category.
    buckets = collections.defaultdict(list)
    for ev in cal["events"]:
        for c in ev["categories"]:
            if ev["venue"] in have.get(c, set()):
                continue
            buckets[(ev["venue"], c)].append(ev)

    # One offering per church per theme, carrying all its categories together.
    by_church_theme = collections.defaultdict(lambda: {"cats": set(), "events": []})
    for (venue, cat), evs in buckets.items():
        theme = evs[0]["theme"]
        row = by_church_theme[(venue, theme)]
        row["cats"].add(cat)
        for e in evs:
            if e not in row["events"]:
                row["events"].append(e)

    # A church that already runs something recurring is a real partner, so its
    # occasional gatherings count too. A men's fish fry belongs on the men's
    # page when that church keeps a men's rhythm; a church we carry nothing else
    # from does not get an offering off a single date.
    recurring_churches = set()
    for (venue, theme), row in by_church_theme.items():
        if rhythm_for(row["events"]):
            recurring_churches.add(venue)
    for e in entries:
        if e["house"] == "out" and e.get("rhythm") and (e.get("venue") or "").strip():
            recurring_churches.add(e["venue"])

    added, skipped = [], []
    for (venue, theme), row in sorted(by_church_theme.items()):
        if venue.lower() in ours:
            continue
        events = sorted(row["events"], key=lambda e: e["date"])
        titles = collections.Counter(clean(e["title"]) for e in events)
        # The name a church repeats is the name of the thing.
        name = next((t for t, n in titles.most_common() if t and not GENERIC.match(t)), None)
        if not name:
            name = titles.most_common(1)[0][0] if titles else None
        if not name:
            continue
        church = funnel.get(venue, {})
        slug = re.sub(r"[^a-z0-9]+", "-", f"{venue} {name}".lower()).strip("-")[:60]
        if slug in known_slugs:
            continue
        known_slugs.add(slug)
        # No rhythm of its own is fine if the church is already a partner.
        rhythm = rhythm_for(events)
        occasional = False
        if not rhythm:
            if venue not in recurring_churches:
                skipped.append((venue, name))
                continue
            occasional = True
        label = events[0]["themeLabel"]
        added.append({
            "slug": slug,
            "name": name,
            "org": None,
            "venue": venue,
            "venueUrl": church.get("website"),
            "house": "out",
            "tier": "partner-church",
            "categories": sorted(row["cats"]),
            "summary": (f"{label} at {venue}. Occasional rather than weekly, so watch the calendar."
                        if occasional else summary_for(name, venue, label, events)),
            "why": None,
            "bestFor": None,
            "area": church.get("city") or events[0].get("city"),
            "city": events[0].get("city") or church.get("city"),
            "rhythm": rhythm,
            "href": None,
            "website": church.get("website"),
            "handoff": {
                "how": "The dates are on our calendar. Turn up, or ask us and we will introduce you first.",
                "person": None,
            },
            "calendar": {
                "url": None, "format": "ics",
                "cadence": "occasional" if occasional else "weekly", "sync": "available",
                "evidence": f"{len(events)} dates on The Church Map's Grand Rapids calendar",
            },
            "status": "proposed",
            "verified": None,
            "lat": church.get("lat"),
            "lng": church.get("lng"),
        })

    occ = sum(1 for a in added if a["calendar"]["cadence"] == "occasional")
    print(f"{len(added)} offerings to add ({occ} occasional, at churches we already carry), "
          f"{len(skipped)} left on the calendar only\n")
    for a in added:
        print(f"  {a['name'][:34]:34} at {a['venue'][:34]:34} {a['rhythm'] or '':<26} {','.join(a['categories'])[:36]}")

    if skipped:
        print("\n  left as events, no standing rhythm:")
        for venue, name in skipped[:14]:
            print(f"    {name[:38]:38} at {venue[:34]}")

    if write and added:
        directory["entries"] = entries + added
        json.dump(directory, open(MINISTRIES, "w"), indent="\t", ensure_ascii=False)
        open(MINISTRIES, "a").write("\n")
        print(f"\nwritten to content/ministries.json")
    elif not write:
        print("\n(dry run — pass --write to add them)")


main()
