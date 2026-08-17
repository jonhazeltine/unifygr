#!/usr/bin/env python3
"""Render a small set of shared Grand Rapids basemaps.

Rather than one image per category, we render a handful of standard frames at
different zooms. Any page then picks the tightest frame that contains its own
pins and draws them itself. That lets every category have a real map of its own
without carrying a separate image for each one.

    python3 scripts/build-ministry-maps.py

Writes public/art/maps/ and content/ministry-maps.json.
"""
import json, os, subprocess, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public/art/maps")
MANIFEST = os.path.join(ROOT, "content/ministry-maps.json")
STYLE = "mapbox/dark-v11"
W, H = 880, 540

# Centred near our building and widening out to the region. A page picks the
# first frame all of its pins fit inside.
FRAMES = [
    ("near", 42.999923, -85.601454, 12.50),
    ("city", 42.980000, -85.640000, 11.25),
    ("metro", 42.955000, -85.640000, 10.25),
    ("region", 42.980000, -85.650000, 9.25),
    ("wide", 42.930000, -85.700000, 8.50),
]


def token():
    out = subprocess.run(
        ["grep", "^MAPBOX_TOKEN=", os.path.expanduser("~/.claude/credentials.env")],
        capture_output=True, text=True).stdout.strip()
    return out.split("=", 1)[1]


def fetch(clat, clng, zoom, path):
    url = (f"https://api.mapbox.com/styles/v1/{STYLE}/static/"
           f"{clng:.6f},{clat:.6f},{zoom:.2f},0/{W}x{H}@2x"
           f"?access_token={token()}&logo=false&attribution=false")
    data = urllib.request.urlopen(url, timeout=60).read()
    if not data.startswith(b"\x89PNG"):
        raise RuntimeError(f"not a png for {path}")
    tmp = path + ".png"
    with open(tmp, "wb") as f:
        f.write(data)
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "78",
                    tmp, "--out", path], capture_output=True, check=True)
    os.remove(tmp)
    return os.path.getsize(path)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    keep = {f[0] for f in FRAMES}
    for stale in os.listdir(OUT_DIR):
        if stale.endswith(".jpg") and stale[:-4] not in keep:
            os.remove(os.path.join(OUT_DIR, stale))

    frames, total = [], 0
    for name, lat, lng, zoom in FRAMES:
        path = os.path.join(OUT_DIR, f"{name}.jpg")
        size = fetch(lat, lng, zoom, path)
        total += size
        frames.append({"name": name, "src": f"/art/maps/{name}.jpg",
                       "lat": lat, "lng": lng, "zoom": zoom, "w": W, "h": H})
        print(f"  {name:8} zoom {zoom:5.2f}  {size/1024:6.0f} KB")

    json.dump({"frames": frames}, open(MANIFEST, "w"), indent="\t")
    open(MANIFEST, "a").write("\n")
    print(f"\n{len(frames)} shared frames, {total/1024:.0f} KB total")


main()
