"""Reproduce the raw-page verification (see VALIDATION.md).
Usage: python3 -I tools/fetch_raw.py notes /path/outside/repo/raw
"""
import json, re, sys, html, urllib.request, os
S = sys.argv[1]  # notes folder (GU.json ... EXP.json)
RAW = sys.argv[2]  # local folder for raw page text (never committed: copyright)
out = {}
def text_of(raw):
    raw = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?s)</?[A-Za-z!][^>]*>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(raw)).strip()
for fam in ["GU", "EV", "CH", "DS", "EXP"]:
    d = json.load(open(f"{S}/{fam}.json"))
    for a in d["articles"]:
        url = a["canonical_url"]
        if fam == "GU":
            url = url.replace("https://www.growthunhinged.com/p/", "https://kylepoyar.substack.com/p/")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "Accept": "text/html"})
            raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
            t = text_of(raw)
            blocked = bool(re.search(r"just a moment|cf-chl|attention required|enable javascript and cookies", raw[:5000], re.I))
            open(f"{RAW}/{a['id']}.txt", "w").write(t)
            out[a["id"]] = {"url": url, "words": len(t.split()), "blocked": blocked}
        except Exception as e:
            out[a["id"]] = {"url": url, "error": str(e)[:120]}
        print(a["id"], out[a["id"]])
json.dump(out, open(f"{RAW}/fetch_log.json", "w"), indent=1)
