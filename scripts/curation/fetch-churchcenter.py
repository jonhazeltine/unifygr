#!/usr/bin/env python3
"""Read every Church Center church near us.

Planning Center's Church Center is the most common thing our neighbours run,
and until now we got nothing out of it. The Church Map records 168 links into
churchcenter.com across 44 accounts inside our radius and every one is filed
"unreachable", because a Church Center page is an empty shell that fills itself
in from an API. Fetching the page gets you nothing. You have to ask the API.

The site hands out its own key, so no login and no browser are needed:

    POST https://<account>.churchcenter.com/sessions/tokens   -> a bearer token
    GET  https://api.churchcenter.com/registrations/v2/events  with that token
    GET  https://api.churchcenter.com/groups/v2/groups         with that token

Groups are the reason to bother. A signup event is a one-off, but a group is a
standing ministry with its rhythm written on it — "Wings and Witness (Men's
group), Weekly, Tuesdays @ 5:30 p.m." That is a curated ministry, already in the
words the church chose.

    python3 scripts/curation/fetch-churchcenter.py            # show what is out there
    python3 scripts/curation/fetch-churchcenter.py --write    # save the finds

Everything lands unconfirmed. A person still says yes.
"""
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RULES = os.path.join(ROOT, "content/curation-rules.json")
OUT = os.path.join(ROOT, "content/churchcenter-finds.json")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")

DAY = re.compile(r"\b(sun|mon|tues|wednes|thurs|fri|satur)day", re.I)

# A group named after the family whose living room it meets in is not an
# offering to the city, it is that church's own small groups. Ours stay ours
# too, so we would not point anybody at somebody else's anyway.
PRIVATE = re.compile(r"^[A-Z][a-z]+(\s*&\s*[A-Z][a-z]+)?\s+(small group|life group|"
                     r"community group|home group|group)$", re.I)


def cred(key):
    path = os.path.expanduser("~/.claude/credentials.env")
    out = subprocess.run(["grep", f"^{key}=", path], capture_output=True, text=True).stdout
    return out.strip().split("=", 1)[1]


def churchmap(path):
    url = cred("CHURCHMAP_SUPABASE_URL").rstrip("/")
    key = cred("CHURCHMAP_SUPABASE_SERVICE_ROLE_KEY")
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept-Profile": "public"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read())


def http(url, method="GET", headers=None, data=None, timeout=25):
    req = urllib.request.Request(url, method=method, data=data,
                                 headers={"User-Agent": UA, "Accept": "application/json",
                                          **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(600_000)
    except urllib.error.HTTPError as exc:
        return exc.code, b""
    except Exception:
        return 0, b""


def accounts_near(centre, radius):
    """Every Church Center account belonging to a church inside our radius.

    The Church Map already collected these links while looking for calendar
    feeds. It could not read them, but it wrote down where they were.
    """
    dlat = radius / 69.0
    dlng = radius / (69.0 * math.cos(math.radians(centre["lat"])))
    churches = churchmap(
        "churches?select=id,name,city"
        f"&display_lat=gte.{centre['lat'] - dlat}&display_lat=lte.{centre['lat'] + dlat}"
        f"&display_lng=gte.{centre['lng'] - dlng}&display_lng=lte.{centre['lng'] + dlng}"
        "&limit=5000")
    by_id = {c["id"]: c for c in churches}

    feeds = []
    ids = list(by_id)
    for i in range(0, len(ids), 200):
        feeds += churchmap("church_calendar_feeds?select=church_id,feed_url"
                           f"&church_id=in.({','.join(ids[i:i + 200])})")

    found = {}
    for f in feeds:
        m = re.match(r"https?://([a-z0-9-]+)\.churchcenter\.com", f.get("feed_url") or "")
        if m and f["church_id"] in by_id:
            found.setdefault(m.group(1), set()).add(by_id[f["church_id"]]["name"])
    return {sub: sorted(names) for sub, names in found.items()}


def pull(sub, cache_dir):
    """Ask one account what it publishes.

    Deliberately slow and sequential. These are small churches' servers and
    Planning Center throttles hard — asking 44 accounts at once earns a 403 for
    everybody. One at a time with a pause is fast enough for something that only
    needs running once a week, and the answers are cached so a re-run costs
    nobody anything.
    """
    cached = os.path.join(cache_dir, f"{sub}.json")
    if os.path.exists(cached):
        return sub, json.load(open(cached))

    code, body = http(f"https://{sub}.churchcenter.com/sessions/tokens", method="POST", data=b"")
    for wait in (5, 20, 60):
        if code != 403:
            break
        time.sleep(wait)
        code, body = http(f"https://{sub}.churchcenter.com/sessions/tokens",
                          method="POST", data=b"")
    if code != 200:
        return sub, None
    try:
        token = json.loads(body)["data"]["attributes"]["token"]
    except Exception:
        return sub, None

    head = {"Authorization": f"Bearer {token}", "X-Church-Center-Application": sub}
    out = {}
    for key, path in [
        ("events", "registrations/v2/events?order=starts_at&filter=unarchived,published"
                   "&fields[Event]=name,starts_at,ends_at,event_time,registration_state"
                   "&per_page=100"),
        ("groups", "groups/v2/groups?per_page=100"),
    ]:
        code, body = http(f"https://api.churchcenter.com/{path}", headers=head)
        if code == 200:
            try:
                out[key] = json.loads(body)["data"]
            except Exception:
                out[key] = []
        time.sleep(1.0)

    json.dump(out, open(cached, "w"))
    return sub, out


def excluded(name, rules):
    """The rules Jon set, applied to a name we did not write."""
    lowered = name.lower()
    for pat in rules["noOverlapWithOurSignature"]["oursByName"]["titlePatterns"]:
        if re.search(pat, lowered):
            return "ours on a Sunday"
    for pat in rules["traditionsToAvoid"]["patterns"]:
        if re.search(pat, lowered):
            return "a tradition we stay clear of"
    if PRIVATE.match(name.strip()):
        return "somebody's living room"
    return None


def main():
    write = "--write" in sys.argv
    rules = json.load(open(RULES))
    subs = accounts_near(rules["scope"]["centre"], rules["scope"]["radiusMiles"])
    print(f"{len(subs)} Church Center accounts inside {rules['scope']['radiusMiles']} miles")

    cache_dir = os.path.join(ROOT, ".cache/churchcenter")
    os.makedirs(cache_dir, exist_ok=True)
    harvest = {}
    for i, sub in enumerate(sorted(subs), 1):
        harvest[sub] = pull(sub, cache_dir)[1]
        print(f"   {i:>2}/{len(subs)}  {sub:34} "
              f"{'ok' if harvest[sub] else 'no answer'}", flush=True)
        time.sleep(1.5)

    answered = {s: o for s, o in harvest.items() if o}
    print(f"{len(answered)} answered\n")

    finds, dropped = [], {}
    for sub, out in sorted(answered.items()):
        kept = []
        for g in out.get("groups", []):
            a = g["attributes"]
            name = (a.get("name") or "").strip()
            schedule = (a.get("schedule") or "").strip()
            if not name or not DAY.search(schedule):
                continue                      # no rhythm means nothing to point anyone at
            why = excluded(name, rules)
            if why:
                dropped[why] = dropped.get(why, 0) + 1
                continue
            kept.append({"kind": "group", "name": name, "rhythm": schedule,
                         "url": a.get("church_center_web_url"),
                         "description": (a.get("description") or "").strip()[:300] or None})
        for e in out.get("events", []):
            a = e["attributes"]
            name = (a.get("name") or "").strip()
            starts = (a.get("starts_at") or "")[:10]
            if not name or not starts:
                continue
            why = excluded(name, rules)
            if why:
                dropped[why] = dropped.get(why, 0) + 1
                continue
            kept.append({"kind": "event", "name": name, "date": starts,
                         "time": a.get("event_time"), "url": None, "description": None})
        if kept:
            finds.append({"account": sub, "churches": subs[sub],
                          "source": f"https://{sub}.churchcenter.com",
                          "found": kept, "confirmed": False})

    groups = sum(1 for f in finds for k in f["found"] if k["kind"] == "group")
    events = len(finds and [k for f in finds for k in f["found"] if k["kind"] == "event"] or [])
    print(f"{groups} standing ministries with a real rhythm, {events} dated events, "
          f"across {len(finds)} churches")
    for why, n in sorted(dropped.items(), key=lambda x: -x[1]):
        print(f"   dropped {n:>3}  {why}")

    print()
    for f in finds[:6]:
        print(f"  {', '.join(f['churches'])[:56]}")
        for k in f["found"][:4]:
            print(f"     {k['name'][:46]:46} {(k.get('rhythm') or k.get('date') or '')[:40]}")

    if write:
        json.dump({
            "_comment": ("What the Church Center churches near us publish. Their own words, "
                         "their own schedules, read from the API their own site uses. Nothing "
                         "here is live on the site until somebody confirms it."),
            "checkedOn": date.today().isoformat(),
            "accounts": finds,
        }, open(OUT, "w"), indent="\t", ensure_ascii=False)
        open(OUT, "a").write("\n")
        print(f"\nwrote {os.path.relpath(OUT, ROOT)}")
    else:
        print("\n(dry run — pass --write to save)")


main()
