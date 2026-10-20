"""Reproduce the raw-page verification (see VALIDATION.md).
Usage: python3 -I tools/check_findings.py notes /path/outside/repo/raw
"""
import json, re, sys
S = sys.argv[1]  # notes folder (GU.json ... EXP.json)
RAW = sys.argv[2]  # local folder for raw page text (never committed: copyright)
STOP = set("the and for with that this from are was were not but its their they them into than then when what which while have has had will would could should about over more most less your you our can may also only each such other these those been being does did done just very".split())
rows = []
for fam in ["GU", "EV", "CH", "DS", "EXP"]:
    d = json.load(open(f"{S}/{fam}.json"))
    for a in d["articles"]:
        try:
            raw = open(f"{RAW}/{a['id']}.txt").read().lower()
        except FileNotFoundError:
            raw = ""
        for f in a.get("findings", []):
            s = f["summary"]
            nums = set(re.findall(r"\d+(?:[.,]\d+)?%?", s))
            nums = {n for n in nums if not re.fullmatch(r"20[12]\d|19\d\d", n)}
            missing_nums = [n for n in nums if n.replace(",", "").rstrip("%") not in raw.replace(",", "")]
            words = [w for w in re.findall(r"[a-z][a-z-]{4,}", s.lower()) if w not in STOP]
            hit = sum(1 for w in set(words) if w in raw) / max(1, len(set(words)))
            rows.append((f["id"], round(hit, 2), missing_nums, a["access"]))
flag = [r for r in rows if r[2] or r[1] < 0.45]
print(len(rows), "findings;", len(flag), "flagged")
for r in flag: print(r)
