#!/usr/bin/env python3
"""What can we actually read from each church, and by what technique?

Classifies every candidate church into an extraction route, so we know what the
Railway job has to be able to do rather than guessing.

Routes, best first:
  ics       a real calendar feed
  bulletin  a weekly PDF or page we can read
  events    an events page carrying real dates
  ministry  ministry pages naming what they run, but no dates
  social    nothing on their own site; activity is on Facebook/Instagram
  none      nothing readable anywhere
"""
import json, os, re, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")

DATED = re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\b", re.I)
STANDING = re.compile(r"\b(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)[a-z]*s?\b[^.|<>\n]{0,34}?"
                      r"\b\d{1,2}(?::\d{2})?\s*(am|pm)", re.I)
ICS = re.compile(r"\.ics\b|calendar\.google\.com/calendar/ical", re.I)
MINISTRY = re.compile(r"\b(youth|students?|kids|children|nursery|small group|city group|life group|"
                      r"men'?s|women'?s|prayer|recovery|bible study)\b", re.I)
BULLETIN_LINK = re.compile(r"(bulletin|publication|newsletter|weekly|announce)", re.I)
EVENT_LINK = re.compile(r"(event|calendar|whats-?on|happening)", re.I)
MINISTRY_LINK = re.compile(r"(ministr|grow|connect|groups|next-?steps)", re.I)
SOCIAL = re.compile(r"(facebook\.com/[A-Za-z0-9._-]+|instagram\.com/[A-Za-z0-9._-]+)", re.I)


def get(url, timeout=18, cap=400_000):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(cap), r.geturl(), r.headers.get("Content-Type", "")


def text_of(raw):
    h = raw.decode("utf-8", "ignore")
    h = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", h, flags=re.S | re.I)
    h = re.sub(r"<[^>]+>", " ", h)
    return re.sub(r"\s+", " ", h.replace("&amp;", "&").replace("&nbsp;", " "))


def pdf_text(raw, path):
    import subprocess
    open(path, "wb").write(raw)
    try:
        return subprocess.run(["pdftotext", "-layout", path, "-"],
                              capture_output=True, text=True, timeout=45).stdout
    except Exception:
        return ""


def profile(entry):
    name, site = entry
    out = {"church": name, "site": site, "route": "none", "evidence": "",
           "social": [], "bulletin": None, "events_url": None}
    if not site:
        out["evidence"] = "no website on record"
        return out
    try:
        raw, final, _ = get(site)
    except Exception as exc:
        out["route"] = "unreachable"
        out["evidence"] = type(exc).__name__
        return out
    home = raw.decode("utf-8", "ignore")
    t = text_of(raw)
    host = urllib.parse.urlparse(final).netloc
    out["social"] = sorted({m.group(0) for m in SOCIAL.finditer(home)})[:3]

    links = [urllib.parse.urljoin(final, h) for h in re.findall(r'href="([^"#]+)"', home)]
    same = [l for l in links if urllib.parse.urlparse(l).netloc == host]

    if ICS.search(home):
        out.update(route="ics", evidence="feed linked on the homepage")
        return out

    # A weekly bulletin is the richest thing most small churches publish.
    for l in [l for l in same if BULLETIN_LINK.search(l)][:3]:
        try:
            braw, bfinal, ctype = get(l)
        except Exception:
            continue
        pdfs = [urllib.parse.urljoin(bfinal, p)
                for p in re.findall(r'href="([^"]+\.pdf[^"]*)"', braw.decode("utf-8", "ignore"), re.I)]
        if pdfs:
            try:
                praw, _, _ = get(pdfs[0], timeout=35, cap=3_000_000)
                ptxt = pdf_text(praw, "/tmp/_b.pdf")
            except Exception:
                ptxt = ""
            hits = len(STANDING.findall(ptxt)) + len(DATED.findall(ptxt))
            if hits >= 2:
                out.update(route="bulletin", bulletin=pdfs[0],
                           evidence=f"{len(pdfs)} bulletins, newest has {hits} dated/standing lines")
                return out
        btxt = text_of(braw)
        if len(STANDING.findall(btxt)) + len(DATED.findall(btxt)) >= 3:
            out.update(route="bulletin", bulletin=bfinal, evidence="bulletin page carries dates")
            return out

    for l in [l for l in same if EVENT_LINK.search(l)][:3]:
        try:
            eraw, efinal, _ = get(l)
        except Exception:
            continue
        et = text_of(eraw)
        if ICS.search(eraw.decode("utf-8", "ignore")):
            out.update(route="ics", events_url=efinal, evidence="feed on the events page")
            return out
        d = len(DATED.findall(et))
        if d >= 3:
            out.update(route="events", events_url=efinal, evidence=f"{d} dated mentions")
            return out

    for l in [l for l in same if MINISTRY_LINK.search(l)][:3]:
        try:
            mraw, mfinal, _ = get(l)
        except Exception:
            continue
        mt = text_of(mraw)
        named = {m.group(0).lower() for m in MINISTRY.finditer(mt)}
        if len(named) >= 3 and len(mt) > 2500:
            out.update(route="ministry", events_url=mfinal,
                       evidence=f"names {len(named)} ministries, no dates")
            return out

    if len(STANDING.findall(t)) + len(DATED.findall(t)) >= 2:
        out.update(route="events", events_url=final, evidence="dates on the homepage")
        return out
    if out["social"]:
        out.update(route="social", evidence="nothing on their site; activity is on social")
        return out
    out["evidence"] = "service time only"
    return out


CHURCHES = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "candidates_in.json")))
with ThreadPoolExecutor(max_workers=8) as ex:
    rows = list(ex.map(profile, CHURCHES))

order = {"ics": 0, "bulletin": 1, "events": 2, "ministry": 3, "social": 4, "none": 5, "unreachable": 6}
rows.sort(key=lambda r: (order.get(r["route"], 9), r["church"]))
print(f"{'route':10} {'church':38} evidence")
for r in rows:
    print(f"{r['route']:10} {r['church'][:38]:38} {r['evidence'][:52]}")
    if r["bulletin"]:
        print(f"{'':10} {'':38} -> {r['bulletin'][:70]}")
    if r["social"]:
        print(f"{'':10} {'':38} social: {', '.join(r['social'])[:64]}")
json.dump(rows, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "source-routes.json"), "w"), indent=1)
