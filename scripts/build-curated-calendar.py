#!/usr/bin/env python3
"""Build our calendar from The Church Map's published Grand Rapids events.

The Church Map already gathers the calendars Grand Rapids churches publish
themselves, parses them, and sorts them into themes:

    https://thechurchmap.com/grandrapids/events
    https://thechurchmap.com/api/platforms/grandrapids/events

We read that rather than re-parsing the same ICS files, which is both less work
and a better read of the data.

This is still not a mirror. Every event that survives is curated into one New
Life calendar: a building's own housekeeping is dropped, congregations outside
historic Christian orthodoxy are left out, duplicate church records are folded
together, and each event is tagged with the categories it belongs to on our
pages.

    python3 scripts/build-curated-calendar.py

Writes content/curated-events.json.
"""
import json, math, os, re, subprocess, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content/curated-events.json")
FUNNEL = os.path.join(ROOT, "content/church-funnel.json")
API = "https://thechurchmap.com/api/platforms/grandrapids/events"
CENTER = (42.999923, -85.601454)   # New Life, Knapp's Corner
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")

# The Church Map's themes, mapped onto our own categories.
THEME_CATEGORIES = {
    "youth": ["high-school", "middle-school"],
    "kids": ["childrens-ministry", "nursery"],
    "young_adults": ["young-adults"],
    "womens": ["womens-ministry", "womens-bible-study"],
    "mens": ["mens-ministry"],
    "prayer": ["prayer-meetings", "intercession"],
    "bible_study": ["bible-study"],
    "worship_music": ["worship-nights", "corporate-worship"],
    "sunday_service": ["corporate-worship"],
    "family": ["parenting"],
    "seniors": ["senior-adults"],
    "serve_outreach": ["local-outreach"],
    "care_support": ["grief-support"],
    "class_training": ["discipleship-groups"],
    "sports_recreation": ["adult-sports"],
    "arts_culture": ["arts-ministry"],
    "missions_trip": ["short-term-missions"],
    "fellowship_food": ["small-groups"],
}
THEME_LABEL = {
    "youth": "Youth", "kids": "Kids", "young_adults": "Young adults",
    "womens": "Women", "mens": "Men", "prayer": "Prayer",
    "bible_study": "Bible study", "worship_music": "Worship",
    "sunday_service": "Sunday service", "family": "Family",
    "seniors": "Seniors", "serve_outreach": "Serve",
    "care_support": "Care & support", "class_training": "Classes",
    "sports_recreation": "Sport", "arts_culture": "Arts",
    "missions_trip": "Mission trips", "fellowship_food": "Food & fellowship",
    "other": "Everything else",
}

# A church's own housekeeping, and the outside groups that rent its building.
DENY = re.compile(
    r"(^(office hours|board|staff|elders?|council|deacons?|trustee|committee|"
    r"building use|private|setup|set up|clean ?up|rehearsal|maintenance|"
    r"tops\b|al-?anon|networkers|senior neighbors|blood drive|voting|polling|"
    r"activity center rental|library public hours|water aerobics|euchre|rental))"
    r"|(-\s*(gym|library|music room|fellowship hall|kitchen|basement)\b)"
    r"|(\broom \d)", re.I)

# Churches we do not carry. Two reasons sit in this one list: congregations
# outside historic Christian orthodoxy, and individual churches New Life has
# asked to leave off. Both are editorial calls, not data problems.
EXCLUDE_CHURCH = re.compile(
    r"\b(unity|unitarian|universalist|science of mind|latter[- ]day|scientolog"
    r"|orthodox|antiochian"
    r"|bauer christian reformed)\b", re.I)

# A saint's feast day is not something we are offering anyone.
SKIP_THEMES = {"liturgical"}


def cred(key):
    out = subprocess.run(
        ["grep", f"^{key}=", os.path.expanduser("~/.claude/credentials.env")],
        capture_output=True, text=True).stdout.strip()
    return out.split("=", 1)[1]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def fetch_all():
    events, offset = [], 0
    while True:
        page = get(f"{API}?theme=all&limit=100&offset={offset}")
        events += page["events"]
        if not page.get("hasMore"):
            return events, page
        offset += 100


def clock(ev):
    if ev.get("allDay") or not ev.get("timeConfident"):
        return None
    start = ev.get("localStart") or ""
    if len(start) < 16:
        return None
    hh, mm = int(start[11:13]), start[14:16]
    suffix = "am" if hh < 12 else "pm"
    return f"{hh % 12 or 12}:{mm}{suffix}".replace(":00", "")


def resolve_distances(church_ids):
    """Look each church up by id and measure it from Knapp's Corner.

    Matching the platform's church records against our funnel by id alone lost
    real churches: the same congregation exists under more than one record
    upstream, so a Rockford church eight miles away was being read as out of
    range. Coordinates settle it.
    """
    url = cred("CHURCHMAP_SUPABASE_URL").rstrip("/")
    key = cred("CHURCHMAP_SUPABASE_SERVICE_ROLE_KEY")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept-Profile": "public"}
    out, ids = {}, [i for i in church_ids if i]
    for i in range(0, len(ids), 60):
        path = (f"churches?select=id,display_lat,display_lng"
                f"&id=in.({','.join(ids[i:i + 60])})&limit=1000")
        req = urllib.request.Request(f"{url}/rest/v1/{path}", headers=headers)
        with urllib.request.urlopen(req, timeout=90) as resp:
            for row in json.loads(resp.read()):
                la, ln = row.get("display_lat"), row.get("display_lng")
                if la is None or ln is None:
                    continue
                dy = (la - CENTER[0]) * 69.0
                dx = (ln - CENTER[1]) * 69.0 * math.cos(math.radians(CENTER[0]))
                out[row["id"]] = round(math.hypot(dx, dy), 1)
    return out


def main():
    funnel = json.load(open(FUNNEL))
    radius = funnel["radiusMiles"]

    raw, meta = fetch_all()
    # The platform reaches further than we do (Muskegon, Holland, Allegan), so
    # events are held to our own radius, measured rather than matched by id.
    distance = resolve_distances({e.get("churchId") for e in raw})
    print(f"published by The Church Map for {meta['platform']['name']}: {len(raw)} events "
          f"over {meta['days']} days")

    events, dropped, out_of_scope, seen = [], 0, 0, set()
    for ev in raw:
        title = (ev.get("title") or "").strip()
        church = (ev.get("churchName") or "").strip()
        if not title or not church:
            continue
        miles = distance.get(ev.get("churchId"))
        if miles is None or miles > radius:
            out_of_scope += 1
            continue
        if EXCLUDE_CHURCH.search(church) or ev.get("theme") in SKIP_THEMES or DENY.search(title):
            dropped += 1
            continue
        day = (ev.get("localStart") or "")[:10]
        # One congregation appears under more than one record upstream, so fold
        # on what a reader would see rather than on the church id.
        key = (day, title.lower(), (ev.get("city") or "").lower())
        if key in seen:
            continue
        seen.add(key)
        theme = ev.get("theme") or "other"
        events.append({
            "title": re.sub(r"\s+", " ", title)[:90],
            "miles": miles,
            "date": day,
            "time": clock(ev),
            "venue": church,
            "city": ev.get("city"),
            "theme": theme,
            "themeLabel": THEME_LABEL.get(theme, theme.replace("_", " ").title()),
            "categories": THEME_CATEGORIES.get(theme, []),
            "cadence": ev.get("cadence"),
            "sort": ev.get("localStart") or day,
        })

    events.sort(key=lambda e: e["sort"])
    by_theme = {}
    for e in events:
        by_theme[e["themeLabel"]] = by_theme.get(e["themeLabel"], 0) + 1

    json.dump({
        "_comment": "New Life's own calendar, curated from The Church Map's published "
                    "Grand Rapids events. Regenerate with scripts/build-curated-calendar.py.",
        "source": "https://thechurchmap.com/grandrapids/events",
        "scope": {"radiusMiles": radius, "churchesInFunnel": funnel["churchCount"]},
        "days": meta.get("days"),
        "themes": by_theme,
        "events": events,
    }, open(OUT, "w"), indent="\t")
    open(OUT, "a").write("\n")

    venues = {e["venue"] for e in events}
    print(f"kept {len(events)} gatherings across {len(venues)} churches; "
          f"left off {dropped} as not an offering, {out_of_scope} as outside our 20 miles")
    for label, n in sorted(by_theme.items(), key=lambda kv: -kv[1]):
        print(f"   {n:5}  {label}")


main()
