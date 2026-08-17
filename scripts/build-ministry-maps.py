#!/usr/bin/env python3
"""Render a real Grand Rapids basemap for the directory and for each family.

Run this whenever ministry coordinates change:

    python3 scripts/build-ministry-maps.py

Basemaps are fetched once from the Mapbox Static Images API and committed to
public/art/maps/, so the site needs no map token at runtime and the pages stay
static. Pins are drawn by the site itself on top of the image, which keeps them
clickable; content/ministry-maps.json records the exact centre and zoom of each
image so the projection lines up.
"""
import json, math, os, subprocess, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public/art/maps")
MANIFEST = os.path.join(ROOT, "content/ministry-maps.json")
STYLE = "mapbox/dark-v11"
W, H = 880, 540
PAD = 0.16       # share of the frame kept clear of pins
FIT_RADIUS = 16  # miles; Holland and the camps are listed, not framed
ZOOM_MIN, ZOOM_MAX = 9.75, 12.5

CHURCH = (42.999923, -85.601454)


def token():
    out = subprocess.run(
        ["grep", "^MAPBOX_TOKEN=", os.path.expanduser("~/.claude/credentials.env")],
        capture_output=True, text=True).stdout.strip()
    return out.split("=", 1)[1]


def world_px(zoom):
    return 512 * (2 ** zoom)


def project(lat, lng, zoom):
    """Web Mercator, in pixels of the whole world at this zoom."""
    wp = world_px(zoom)
    x = (lng + 180.0) / 360.0 * wp
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * wp
    return x, y


def fit(points):
    """Centre and the largest zoom that still fits every point with padding."""
    lats = [p[0] for p in points]
    lngs = [p[1] for p in points]
    clat = (min(lats) + max(lats)) / 2
    clng = (min(lngs) + max(lngs)) / 2
    steps = [x / 4 for x in range(int(ZOOM_MAX * 4), int(ZOOM_MIN * 4) - 1, -1)]
    for zoom in steps:
        cx, cy = project(clat, clng, zoom)
        if all(
            abs(project(lat, lng, zoom)[0] - cx) <= W * (0.5 - PAD)
            and abs(project(lat, lng, zoom)[1] - cy) <= H * (0.5 - PAD)
            for lat, lng in points
        ):
            return clat, clng, zoom
    return clat, clng, ZOOM_MIN


def miles_from_church(lat, lng):
    dy = (lat - CHURCH[0]) * 69.0
    dx = (lng - CHURCH[1]) * 69.0 * math.cos(math.radians(CHURCH[0]))
    return math.hypot(dx, dy)


def fetch(clat, clng, zoom, path):
    tok = token()
    url = (f"https://api.mapbox.com/styles/v1/{STYLE}/static/"
           f"{clng:.6f},{clat:.6f},{zoom:.2f},0/{W}x{H}@2x"
           f"?access_token={tok}&logo=false&attribution=false")
    data = urllib.request.urlopen(url, timeout=60).read()
    if not data.startswith(b"\x89PNG"):
        raise RuntimeError(f"not a png for {path}")
    tmp = path + ".png"
    with open(tmp, "wb") as f:
        f.write(data)
    # A dark basemap keeps its detail as a JPEG at a third of the weight.
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "78",
                    tmp, "--out", path], capture_output=True, check=True)
    os.remove(tmp)
    return os.path.getsize(path)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    directory = json.load(open(os.path.join(ROOT, "content/ministries.json")))
    taxonomy = json.load(open(os.path.join(ROOT, "content/ministry-taxonomy.json")))
    entries = directory["entries"]

    def pins_for(slugs=None):
        out = []
        for e in entries:
            if e.get("house") != "out" or e.get("lat") is None:
                continue
            if slugs is not None and not (set(e["categories"]) & slugs):
                continue
            out.append((e["lat"], e["lng"]))
        return out

    jobs = [("all", pins_for(None))]
    for fam in taxonomy["families"]:
        slugs = {c["slug"] for c in fam["categories"]}
        pts = pins_for(slugs)
        if pts:
            jobs.append((fam["slug"], pts))

    manifest, total = {}, 0
    for slug, pts in jobs:
        # Fit on what is actually nearby; the far ones are listed, not mapped.
        near = [p for p in pts if miles_from_church(*p) <= FIT_RADIUS]
        clat, clng, zoom = fit((near or pts[:1]) + [CHURCH])
        path = os.path.join(OUT_DIR, f"{slug}.jpg")
        size = fetch(clat, clng, zoom, path)
        total += size
        manifest[slug] = {
            "src": f"/art/maps/{slug}.jpg",
            "lat": round(clat, 6), "lng": round(clng, 6),
            "zoom": round(zoom, 2), "w": W, "h": H,
        }
        print(f"  {slug:22} zoom {zoom:5.2f}  {len(pts):3} pins  {size/1024:6.0f} KB")

    json.dump(manifest, open(MANIFEST, "w"), indent="\t")
    open(MANIFEST, "a").write("\n")
    print(f"\n{len(jobs)} maps, {total/1024/1024:.1f} MB total")


main()
