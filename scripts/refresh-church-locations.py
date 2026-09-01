#!/usr/bin/env python3
"""Refresh content/church-locations.json — where each church is.

The partners panel maps the churches offering each kind of gathering. The
events feed we build the calendar from does not carry coordinates, so they are
kept here instead: church ids and locations from The Church Map, which is where
the events come from too.

This is public information — the same pins thechurchmap.com draws — so it lives
in the repo rather than behind a database key the website would have to hold.
It only needs refreshing when a church starts publishing events and has no pin
on the panel's map, which the panel says out loud when it happens.

    python3 scripts/refresh-church-locations.py

Reads CHURCHMAP_SUPABASE_URL and CHURCHMAP_SUPABASE_SERVICE_ROLE_KEY from
~/.claude/credentials.env. Never commit those values.
"""
import json, os, subprocess, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content/church-locations.json")

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
            churches[row["id"]] = [round(lat, 5), round(lng, 5), (row.get("name") or "").strip()[:60]]
        if len(batch) < 1000:
            break
        offset += 1000

    with open(OUT, "w") as f:
        json.dump({
            "_comment": (
                "Where each church is, so the partners panel can map them. Church ids and "
                "coordinates come from The Church Map, which is where our events come from "
                "too — this is public information, kept here so the site needs no database "
                "credentials of its own. Covers a box around Grand Rapids wide enough to hold "
                "everything the events feed reaches. Refresh with "
                "scripts/refresh-church-locations.py."),
            "format": "churchId: [lat, lng, name]",
            "churches": churches,
        }, f, indent=0)
        f.write("\n")
    print(f"{len(churches)} churches written to content/church-locations.json")


main()
