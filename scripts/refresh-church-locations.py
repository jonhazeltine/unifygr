#!/usr/bin/env python3
"""Top up content/church-locations.json — the pins the repo doesn't already have.

The partners panel maps the churches offering each kind of gathering. Most of
those coordinates are already in the repo: content/church-funnel.json holds
every church within 20 miles of us, and content/church-candidates.json holds the
scored worklist. The panel reads both first (see src/lib/partners/locations.ts).

The events feed reaches further than 20 miles, though — Holland, Grand Haven,
Zeeland, Hamilton — so a handful of churches it carries appear in neither. This
writes just those, and nothing the other two files already cover.

Ids and coordinates come from The Church Map, the same source as the events.
This is public information — the same pins thechurchmap.com draws — so it lives
in the repo rather than behind a database key the website would have to hold.
Refresh it when a church starts publishing events and has no pin on the panel's
map, which the panel says out loud when it happens.

    python3 scripts/refresh-church-locations.py

Reads CHURCHMAP_SUPABASE_URL and CHURCHMAP_SUPABASE_SERVICE_ROLE_KEY from
~/.claude/credentials.env. Never commit those values.
"""
import json, os, subprocess, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content/church-locations.json")
ALREADY = ["content/church-funnel.json", "content/church-candidates.json"]
EVENTS = "https://thechurchmap.com/api/platforms/grandrapids/events"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")


def publishing_churches():
    """The churches actually putting events on the feed — the only ones needing a pin."""
    ids, offset = set(), 0
    while True:
        req = urllib.request.Request(
            f"{EVENTS}?theme=all&limit=100&offset={offset}",
            headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            page = json.loads(resp.read())
        for ev in page.get("events", []):
            if ev.get("churchId"):
                ids.add(ev["churchId"])
        if not page.get("hasMore"):
            return ids
        offset += 100

# A box around Grand Rapids wide enough to hold everything the events feed
# reaches: it stretches to Holland, Grand Haven, Zeeland and Dorr.
BOX = {"lat": (42.4, 43.5), "lng": (-86.4, -85.0)}


def cred(key):
    out = subprocess.run(
        ["grep", f"^{key}=", os.path.expanduser("~/.claude/credentials.env")],
        capture_output=True, text=True).stdout.strip()
    if not out:
        raise SystemExit(f"{key} not found in ~/.claude/credentials.env")
    return out.split("=", 1)[1]


def main():
    url = cred("CHURCHMAP_SUPABASE_URL").rstrip("/")
    key = cred("CHURCHMAP_SUPABASE_SERVICE_ROLE_KEY")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept-Profile": "public"}

    # Anything these two already carry does not belong in the top-up.
    covered = set()
    for name in ALREADY:
        with open(os.path.join(ROOT, name)) as f:
            for c in json.load(f)["churches"]:
                if c.get("id") and c.get("lat") is not None and c.get("lng") is not None:
                    covered.add(c["id"])

    wanted = publishing_churches()
    print(f"{len(wanted)} churches are publishing events right now")

    churches, offset = {}, 0
    while True:
        query = (
            "churches?select=id,name,display_lat,display_lng"
            f"&display_lat=gte.{BOX['lat'][0]}&display_lat=lte.{BOX['lat'][1]}"
            f"&display_lng=gte.{BOX['lng'][0]}&display_lng=lte.{BOX['lng'][1]}"
            f"&order=id&limit=1000&offset={offset}"
        )
        req = urllib.request.Request(f"{url}/rest/v1/{query}", headers=headers)
        with urllib.request.urlopen(req, timeout=120) as resp:
            batch = json.loads(resp.read())
        for row in batch:
            lat, lng = row.get("display_lat"), row.get("display_lng")
            if lat is None or lng is None:
                continue
            if row["id"] in covered or row["id"] not in wanted:
                continue
            churches[row["id"]] = [round(lat, 5), round(lng, 5), (row.get("name") or "").strip()[:60]]
        if len(batch) < 1000:
            break
        offset += 1000

    with open(OUT, "w") as f:
        json.dump({
            "_comment": (
                "Coordinates for churches the events feed reaches that "
                "content/church-funnel.json and content/church-candidates.json do not "
                "already carry — almost all of them beyond the 20 miles those two files "
                "cover: Holland, Grand Haven, Zeeland, Hamilton. Those two files are still "
                "the first place the panel looks; this only fills what they miss. Ids and "
                "coordinates come from The Church Map, the same source as the events. "
                "Refresh with scripts/refresh-church-locations.py."),
            "format": "churchId: [lat, lng, name]",
            "churches": churches,
        }, f, indent="\t")
        f.write("\n")
    print(f"{len(covered)} churches already covered by the two existing files")
    print(f"{len(churches)} more written to content/church-locations.json")


main()
