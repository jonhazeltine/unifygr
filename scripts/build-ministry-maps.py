#!/usr/bin/env python3
"""Render a small set of shared Grand Rapids basemaps.

Rather than one image per category, we render a handful of standard frames at
different zooms. Any page then picks the tightest frame that contains its own
pins and draws them itself. That lets every category have a real map of its own
without carrying a separate image for each one.

    python3 scripts/build-ministry-maps.py   (needs Pillow: pip install pillow)

Writes public/art/maps/ and content/ministry-maps.json.
"""
import io, json, os, subprocess, urllib.request

from PIL import Image, ImageEnhance

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


def tone(data: bytes) -> Image.Image:
    """Mapbox's dark style is almost pure charcoal — on our near-black pages it
    reads as an empty rectangle. Lift it and tilt it toward midnight blue so the
    roads, the river and the city labels are actually visible."""
    im = Image.open(io.BytesIO(data)).convert("RGB")
    im = ImageEnhance.Brightness(im).enhance(1.75)
    im = ImageEnhance.Contrast(im).enhance(1.45)
    r, g, b = im.split()
    r = r.point(lambda v: int(v * 0.96))
    b = b.point(lambda v: min(255, int(v * 1.10 + 6)))
    return Image.merge("RGB", (r, g, b))


def fetch(clat, clng, zoom, path):
    url = (f"https://api.mapbox.com/styles/v1/{STYLE}/static/"
           f"{clng:.6f},{clat:.6f},{zoom:.2f},0/{W}x{H}@2x"
           f"?access_token={token()}&logo=false&attribution=false")
    data = urllib.request.urlopen(url, timeout=60).read()
    if not data.startswith(b"\x89PNG"):
        raise RuntimeError(f"not a png for {path}")
    tone(data).save(path, "JPEG", quality=78, optimize=True)
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
