#!/usr/bin/env python3
"""Refresh each curated church's profile from The Church Map.

We do not write bios. Every word of a church's description on this site comes
from that church's own Church Map profile, so when they improve it there, ours
improves with it, and when they remove it, ours goes too. A church that wants a
better bio on our page updates it in one place, which is the place that already
belongs to them.

Run this whenever the calendar is rebuilt:

    python3 scripts/refresh-church-profiles.py            # show what would change
    python3 scripts/refresh-church-profiles.py --write    # apply it

Updates, per curated ministry: venueBio, churchMapUrl, and the denomination.
"""
import json, math, os, subprocess, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MINISTRIES = os.path.join(ROOT, "content/ministries.json")
RULES = os.path.join(ROOT, "content/curation-rules.json")
CHURCHMAP = "https://thechurchmap.com"
BIO_MAX = 400


def cred(key):
    out = subprocess.run(
        ["grep", f"^{key}=", os.path.expanduser("~/.claude/credentials.env")],
        capture_output=True, text=True).stdout.strip()
    return out.split("=", 1)[1]


def api(path):
    url = cred("CHURCHMAP_SUPABASE_URL").rstrip("/")
    key = cred("CHURCHMAP_SUPABASE_SERVICE_ROLE_KEY")
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept-Profile": "public"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read())


def main():
    write = "--write" in sys.argv
    rules = json.load(open(RULES))
    centre = rules["scope"]["centre"]
    radius = rules["scope"]["radiusMiles"] + 5   # a campus can sit just outside
    directory = json.load(open(MINISTRIES))

    def miles(lat, lng):
        dy = (lat - centre["lat"]) * 69.0
        dx = (lng - centre["lng"]) * 69.0 * math.cos(math.radians(centre["lat"]))
        return math.hypot(dx, dy)

    cache = {}

    dlat = radius / 69.0
    dlng = radius / (69.0 * math.cos(math.radians(centre["lat"])))

    def resolve(name):
        """The record for this church that is actually near us.

        Church names are not unique nationally. Matching on name alone once put
        a church in Sanford, North Carolina onto a New Life page.

        The distance filter has to happen in the query, not after it. Asking for
        25 rows named "Mosaic Church" and then keeping the local ones returns
        nothing, because there are 44 of them and not one of the first 25 is in
        Michigan. "Grace Church" has 438. Filtering afterwards fails silently and
        in the worst possible way: it reports the church as not being on the map
        at all, when it is on the map and we simply never asked for it.
        """
        if name in cache:
            return cache[name]
        try:
            rows = api("churches?select=id,name,city,state,description,denomination,url_path,"
                       f"display_lat,display_lng&name=eq.{urllib.parse.quote(name)}"
                       f"&display_lat=gte.{centre['lat'] - dlat}&display_lat=lte.{centre['lat'] + dlat}"
                       f"&display_lng=gte.{centre['lng'] - dlng}&display_lng=lte.{centre['lng'] + dlng}"
                       "&limit=25")
        except Exception:
            rows = []
        near = [
            c for c in rows
            if c.get("display_lat") is not None
            and miles(c["display_lat"], c["display_lng"]) <= radius
        ]
        near.sort(key=lambda c: (0 if (c.get("description") or "").strip() else 1,
                                 miles(c["display_lat"], c["display_lng"])))
        cache[name] = near[0] if near else None
        return cache[name]

    changes, missing = [], []
    for e in directory["entries"]:
        if e.get("house") != "out" or not e.get("venue"):
            continue
        church = resolve(e["venue"])
        if not church:
            missing.append(e["venue"])
            continue

        bio = (church.get("description") or "").strip()[:BIO_MAX] or None
        link = (CHURCHMAP + church["url_path"]) if church.get("url_path") \
            else f"{CHURCHMAP}/grandrapids/church/{church['id']}"

        if e.get("venueBio") != bio:
            was = "had one" if e.get("venueBio") else "blank"
            now = "now has one" if bio else "now blank"
            changes.append(f"{e['venue'][:34]:34} bio {was} -> {now}")
            e["venueBio"] = bio
        if e.get("churchMapUrl") != link:
            changes.append(f"{e['venue'][:34]:34} link updated")
            e["churchMapUrl"] = link
        if church.get("denomination") and not e.get("org"):
            e["org"] = church["denomination"]

    if write:
        json.dump(directory, open(MINISTRIES, "w"), indent="\t", ensure_ascii=False)
        open(MINISTRIES, "a").write("\n")

    venues = {e["venue"] for e in directory["entries"]
              if e.get("house") == "out" and e.get("venue")}
    with_bio = {e["venue"] for e in directory["entries"] if e.get("venueBio")}
    print(f"{len(venues)} curated venues, {len(with_bio)} with a bio from The Church Map")
    print(f"{len(changes)} change(s)")
    for c in changes[:20]:
        print("   ", c)
    if missing:
        print("\nno nearby Church Map record for:")
        for m in sorted(set(missing)):
            print("   ", m)
        print("  (these are not churches, or are not on the map yet)")
    if not write:
        print("\n(dry run — pass --write to apply)")


main()
