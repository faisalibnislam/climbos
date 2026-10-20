"""Copied-prose check: every run of 12 consecutive words in this folder's guides, notes, playbooks
and top-level docs is compared with the private extracted book texts (never committed).

usage: python3 check_overlap.py <dir with BK07.txt ... BK15.txt / hbg2.txt / lean_analytics.txt>
Prints JSON: files checked, shared runs, runs not explained by titles/ISBNs, examples.
"""
import glob
import json
import os
import re
import sys

N = 12
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def words(t):
    return re.findall(r"[a-z0-9']+", t.lower())


def shingles(ws):
    return {" ".join(ws[i:i + N]) for i in range(len(ws) - N + 1)}


book_sh = set()
for f in glob.glob(os.path.join(sys.argv[1], "*.txt")):
    book_sh |= shingles(words(open(f, errors="ignore").read()))
reg = json.load(open(os.path.join(HERE, "source_registry.json")))
# Titles, authors, ISBNs, publishers and chapter headings are attributed metadata, not prose.
titles = " ".join(words(" ".join(b["title"] + " " + " ".join(b["authors"]) + " " + str(b.get("isbn")) + " " + str(b.get("publisher")) + " " + " | ".join(c.get("section", "") for c in b.get("coverage", [])) for b in reg["books"])))
mine = [p for p in glob.glob(os.path.join(HERE, "**", "*"), recursive=True) if p.endswith((".md", ".json")) and "/tools/" not in p and not p.endswith("validation.json")]
runs, examples = 0, []
non_title = 0
for p in mine:
    hits = shingles(words(open(p).read())) & book_sh
    for h in hits:
        runs += 1
        w = h.split()
        in_title = any(" ".join(w[i:i + N - 2]) in titles for i in range(3))  # allow JSON keys or punctuation at the edges
        if not in_title and not re.search(r"\b(isbn|copyright|oceanofpdf)\b", h):
            non_title += 1
            examples.append(f"{os.path.relpath(p, HERE)}: {h}")
print(json.dumps({"files": len(mine), "runs": runs, "non_title_runs": non_title, "examples": examples[:20]}))
