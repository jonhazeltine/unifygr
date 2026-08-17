#!/usr/bin/env python3
"""Read every Grand Rapids-area church website and measure what it actually publishes.

This is the "become aware of the big list" step. For each church we record:
  - does it publish a calendar, and is that calendar kept current with detail
    (updated weekly) or is it a standing "Wednesdays at 6:30" line
  - which ministries it names (youth, kids, midweek, men, women, groups...)
  - how charismatic its own language is
Nothing is judged here. This produces the evidence the curation then filters on.
"""
import json, os, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

SP = os.path.dirname(os.path.abspath(__file__))
CHURCHES = json.load(open(os.path.join(SP, "churches.json")))
OUT = os.path.join(SP, "church-signals.json")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")

def fetch(url, timeout=12, limit=350_000):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ctype = r.headers.get("Content-Type", "")
        if "html" not in ctype and ctype:
            return "", r.geturl()
        return r.read(limit).decode("utf-8", "ignore"), r.geturl()

def strip(html):
    t = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"&[a-z]+;|&#\d+;", " ", t)
    return re.sub(r"\s+", " ", t)

MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?"
DATE_PATTERNS = [
    re.compile(rf"\b{MONTH}\s+\d{{1,2}}\b", re.I),
    re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b"),
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
]
TIME = re.compile(r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)\b", re.I)
WEEKDAY = re.compile(r"\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day[s]?\b", re.I)
YEAR = re.compile(r"\b(20\d{2})\b")

MINISTRY = {
    "youth":        r"\b(youth group|youth ministry|student ministry|high school ministry|middle school ministry|jr\.? high|sr\.? high|teens?)\b",
    "kids":         r"\b(children'?s ministry|kids ministry|kidz|nursery|preschool ministry|elementary ministry|sunday school)\b",
    "midweek":      r"\b(wednesday night|wednesday evening|midweek|mid-week|awana|wednesdays at)\b",
    "small_groups": r"\b(small groups?|life groups?|community groups?|home groups?|connect groups?|growth groups?)\b",
    "mens":         r"\b(men'?s ministry|men'?s group|men'?s breakfast|men'?s bible study)\b",
    "womens":       r"\b(women'?s ministry|women'?s group|women'?s bible study|ladies ministry)\b",
    "young_adults": r"\b(young adults?|college ministry|20s and 30s|collegiate)\b",
    "seniors":      r"\b(senior adults?|senior saints|55\+|golden|prime timers)\b",
    "recovery":     r"\b(celebrate recovery|recovery ministry|addiction|re:?generation)\b",
    "prayer":       r"\b(prayer meeting|prayer night|prayer gathering|intercession|house of prayer)\b",
    "worship_night": r"\b(worship night|night of worship|worship encounter)\b",
    "marriage":     r"\b(marriage ministry|marriage retreat|premarital|marriage conference)\b",
    "esl":          r"\b(esl|english as a second language|english classes)\b",
    "food":         r"\b(food pantry|food bank|community meal|free meal)\b",
    "sports":       r"\b(upward sports|basketball league|sports ministry|soccer camp)\b",
    "vbs":          r"\b(vacation bible school|\bvbs\b|day camp)\b",
}
CHARISMATIC = {
    "strong": r"\b(spirit[- ]filled|charismatic|prophetic|speaking in tongues|baptism (?:in|of) the holy spirit|word of faith|apostolic|healing rooms|supernatural|sozo|five[- ]?fold)\b",
    "denom":  r"\b(assemblies of god|vineyard|foursquare|pentecostal|church of god \(cleveland\)|bethel|international house of prayer|elim|ag church)\b",
    "soft":   r"\b(holy spirit|gifts of the spirit|revival|outpouring|healing prayer|prophecy|encounter god|presence of god)\b",
}
LINK_HINT = re.compile(
    r"(event|calendar|ministr|youth|student|kids|children|next-?gen|connect|grow|groups|what-?s-?on|happening)", re.I)

def analyse(church):
    site = church.get("website")
    row = {"id": church["id"], "name": church["name"], "city": church["city"],
           "lat": church.get("display_lat"), "lng": church.get("display_lng"),
           "denomination": church.get("denomination"), "website": site,
           "reachable": False, "calendar_url": None, "calendar_grade": "none",
           "dates": 0, "times": 0, "years": [], "ministries": [], "charismatic": 0,
           "charismatic_hits": [], "pages_read": 0}
    if not site:
        return row
    try:
        home, final = fetch(site)
    except Exception:
        return row
    if not home:
        return row
    row["reachable"] = True

    pages = [(final, home)]
    cand = []
    for href in re.findall(r"""href=["']([^"'#]+)["']""", home):
        if LINK_HINT.search(href):
            u = urllib.parse.urljoin(final, href).split("?")[0]
            if urllib.parse.urlparse(u).netloc == urllib.parse.urlparse(final).netloc:
                cand.append(u)
    seen = {final}
    for u in cand:
        if len(pages) >= 6:
            break
        if u in seen:
            continue
        seen.add(u)
        try:
            html, fu = fetch(u)
        except Exception:
            continue
        if html:
            pages.append((fu, html))

    row["pages_read"] = len(pages)
    blob = " ".join(strip(h) for _, h in pages).lower()

    for key, pat in MINISTRY.items():
        if re.search(pat, blob, re.I):
            row["ministries"].append(key)

    score = 0
    for weight, key in ((3, "strong"), (3, "denom"), (1, "soft")):
        for m in set(re.findall(CHARISMATIC[key], blob, re.I)):
            score += weight
            row["charismatic_hits"].append(m if isinstance(m, str) else m[0])
    row["charismatic"] = score

    # Grade the calendar on the most event-like page we saw.
    best = None
    for url, html in pages:
        text = strip(html)
        dates = sum(len(p.findall(text)) for p in DATE_PATTERNS)
        times = len(TIME.findall(text))
        years = sorted(set(YEAR.findall(text)))
        is_cal = bool(re.search(r"(event|calendar)", url, re.I))
        cand_score = dates * (2 if is_cal else 1)
        if best is None or cand_score > best[0]:
            best = (cand_score, url, dates, times, years, is_cal)
    if best:
        _, url, dates, times, years, is_cal = best
        current = {"2026", "2027"} & set(years)
        row["dates"], row["times"], row["years"] = dates, times, years
        if is_cal or dates >= 3:
            row["calendar_url"] = url
        if dates >= 8 and current:
            row["calendar_grade"] = "weekly-detail"
        elif dates >= 3 and current:
            row["calendar_grade"] = "current"
        elif dates >= 3:
            row["calendar_grade"] = "stale"
        elif WEEKDAY.search(blob) and times >= 2:
            row["calendar_grade"] = "standing"
    return row

def main():
    todo = [c for c in CHURCHES if c.get("website")]
    print(f"crawling {len(todo)} church sites", flush=True)
    results = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        for i, r in enumerate(ex.map(analyse, todo), 1):
            results.append(r)
            if i % 50 == 0:
                print(f"  {i}/{len(todo)}", flush=True)
    for c in CHURCHES:
        if not c.get("website"):
            results.append({"id": c["id"], "name": c["name"], "city": c["city"],
                            "lat": c.get("display_lat"), "lng": c.get("display_lng"),
                            "denomination": c.get("denomination"), "website": None,
                            "reachable": False, "calendar_url": None,
                            "calendar_grade": "no-website", "dates": 0, "times": 0,
                            "years": [], "ministries": [], "charismatic": 0,
                            "charismatic_hits": [], "pages_read": 0})
    json.dump(results, open(OUT, "w"), indent=1)
    print("wrote", OUT, len(results), flush=True)

main()
