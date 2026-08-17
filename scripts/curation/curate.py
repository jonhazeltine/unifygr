#!/usr/bin/env python3
"""Filter the 1,272-church list down to curation candidates.

Scoring follows the guidelines given: calendar consistency and detail is the
core test, kids/youth/midweek carry extra weight because those need map
coverage, and the charismatic lean is a thumb on the scale rather than a gate.
Youth is grouped by high-school district, because a parent will not drive
across town on a Wednesday.
"""
import json, math, os, collections

SP = os.path.dirname(os.path.abspath(__file__))
sig = {s["id"]: s for s in json.load(open(SP + "/church-signals.json"))}
churches = json.load(open(SP + "/churches.json"))
feeds = json.load(open(SP + "/feeds.json"))
zones = json.load(open(SP + "/hs_zones.json"))

CHURCH_HOME = (42.999923, -85.601454)
CHARIS_FAMILIES = {"pentecostal", "charismatic_network", "apostolic_oneness", "holiness"}

# --- best live feed per church -------------------------------------------------
best_feed = {}
for f in feeds:
    if f.get("status") != "ok" or not (f.get("event_count") or 0):
        continue
    cur = best_feed.get(f["church_id"])
    if not cur or (f.get("event_count") or 0) > (cur.get("event_count") or 0):
        best_feed[f["church_id"]] = f

# --- point in polygon ----------------------------------------------------------
import struct

def _wkb_rings(hexstr):
    """Minimal EWKB reader: returns a list of polygons, each a list of rings."""
    b = bytes.fromhex(hexstr)
    pos = 0

    def u32(little):
        nonlocal pos
        v = struct.unpack_from("<I" if little else ">I", b, pos)[0]
        pos += 4
        return v

    def hdr():
        nonlocal pos
        little = b[pos] == 1
        pos += 1
        t = u32(little)
        if t & 0x20000000:  # SRID present
            u32(little)
        return little, t & 0xFF

    def ring(little):
        nonlocal pos
        n = u32(little)
        fmt = ("<" if little else ">") + "dd"
        pts = []
        for _ in range(n):
            x, y = struct.unpack_from(fmt, b, pos)
            pos += 16
            pts.append((x, y))
        return pts

    def polygon(little):
        return [ring(little) for _ in range(u32(little))]

    little, t = hdr()
    if t == 3:
        return [polygon(little)]
    if t == 6:
        out = []
        for _ in range(u32(little)):
            l2, t2 = hdr()
            out.append(polygon(l2))
        return out
    return []


_ring_cache = {}


def rings(geom):
    if not geom:
        return []
    if isinstance(geom, str):
        if geom not in _ring_cache:
            try:
                _ring_cache[geom] = _wkb_rings(geom)
            except Exception:
                _ring_cache[geom] = []
        return _ring_cache[geom]
    t = geom.get("type")
    if t == "Polygon":
        return [geom["coordinates"]]
    if t == "MultiPolygon":
        return geom["coordinates"]
    return []

def inside(lng, lat, geom):
    for poly in rings(geom):
        if not poly:
            continue
        outer = poly[0]
        c = False
        j = len(outer) - 1
        for i in range(len(outer)):
            xi, yi = outer[i][0], outer[i][1]
            xj, yj = outer[j][0], outer[j][1]
            if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi):
                c = not c
            j = i
        if c:
            return True
    return False

def district_for(lat, lng):
    for z in zones:
        if inside(lng, lat, z.get("geometry")):
            return z["district_name"]
    return None

def miles(lat, lng):
    dy = (lat - CHURCH_HOME[0]) * 69.0
    dx = (lng - CHURCH_HOME[1]) * 69.0 * math.cos(math.radians(CHURCH_HOME[0]))
    return math.hypot(dx, dy)

CAL_POINTS = {"ics-feed": 5, "weekly-detail": 4, "current": 3, "standing": 2, "stale": 1,
              "none": 0, "no-website": 0}

rows = []
for c in churches:
    s = sig.get(c["id"], {})
    lat, lng = c.get("display_lat"), c.get("display_lng")
    feed = best_feed.get(c["id"])
    grade = "ics-feed" if feed else s.get("calendar_grade", "none")
    mins = set(s.get("ministries") or [])

    charis = 0
    why = []
    if c.get("family_slug") in CHARIS_FAMILIES:
        charis += 3
        why.append(c["family_slug"])
    lang = s.get("charismatic", 0)
    if lang >= 4:
        charis += 2
        why.append("language")
    elif lang >= 1:
        charis += 1
        why.append("language-soft")

    score = CAL_POINTS.get(grade, 0) * 2
    score += 2 * len({"youth"} & mins) + 2 * len({"kids"} & mins) + 2 * len({"midweek"} & mins)
    score += len({"small_groups", "mens", "womens", "young_adults", "prayer", "recovery",
                  "vbs", "worship_night", "food"} & mins)
    score += charis

    rows.append({
        "id": c["id"], "name": c["name"], "city": c["city"],
        "website": c.get("website"), "lat": lat, "lng": lng,
        "family": c.get("family_slug"), "denomination": c.get("denomination"),
        "grade": grade, "feed_url": (feed or {}).get("resolved_ics_url"),
        "feed_events": (feed or {}).get("event_count"),
        "calendar_url": s.get("calendar_url"),
        "ministries": sorted(mins), "charismatic": charis, "charis_why": why,
        "miles": round(miles(lat, lng), 1) if lat and lng else None,
        "district": district_for(lat, lng) if lat and lng else None,
        "score": score,
    })

rows.sort(key=lambda r: -r["score"])
json.dump(rows, open(SP + "/candidates.json", "w"), indent=1)

live = [r for r in rows if r["grade"] in ("ics-feed", "weekly-detail", "current")]
print(f"TOTAL churches: {len(rows)}")
print(f"Publish a current calendar: {len(live)}   (of which real ICS feeds: {sum(1 for r in rows if r['grade']=='ics-feed')})")
print(f"Placed in a high-school district: {sum(1 for r in rows if r['district'])}")

print("\n================ TOP 30 CURATION CANDIDATES ================")
print(f"{'score':>5} {'cal':<13} {'ch':>2} {'mi':>5}  {'name':<38} {'district'}")
for r in rows[:30]:
    print(f"{r['score']:5} {r['grade']:<13} {r['charismatic']:>2} {str(r['miles']):>5}  "
          f"{r['name'][:38]:<38} {(r['district'] or '-')[:30]}")

print("\n================ YOUTH COVERAGE BY SCHOOL DISTRICT ================")
by = collections.defaultdict(list)
for r in rows:
    if r["district"] and "youth" in r["ministries"]:
        by[r["district"]].append(r)
allz = sorted({z["district_name"] for z in zones})
for d in allz:
    got = sorted(by.get(d, []), key=lambda r: -r["score"])
    strong = [r for r in got if r["grade"] in ("ics-feed", "weekly-detail", "current")]
    flag = "GAP " if not strong else "    "
    top = got[0]["name"][:34] if got else "-"
    print(f"{flag}{d[:38]:<38} youth:{len(got):>3}  with-live-calendar:{len(strong):>2}   best: {top}")

print("\n================ MIDWEEK COVERAGE BY DISTRICT ================")
bym = collections.defaultdict(list)
for r in rows:
    if r["district"] and "midweek" in r["ministries"]:
        bym[r["district"]].append(r)
for d in allz:
    got = bym.get(d, [])
    strong = [r for r in got if r["grade"] in ("ics-feed", "weekly-detail", "current")]
    flag = "GAP " if not strong else "    "
    print(f"{flag}{d[:38]:<38} midweek:{len(got):>3}  with-live-calendar:{len(strong):>2}")

print("\n================ CHARISMATIC + LIVE CALENDAR ================")
cc = [r for r in rows if r["charismatic"] >= 3 and r["grade"] in ("ics-feed", "weekly-detail", "current")]
print(f"{len(cc)} churches")
for r in sorted(cc, key=lambda r: -r["score"])[:20]:
    print(f"  {r['score']:3} {r['grade']:<13} {r['name'][:36]:<36} {r['city'][:14]:<14} "
          f"{','.join(r['charis_why'])[:28]:<28} {','.join(r['ministries'])[:40]}")
