"""Verbatim-overlap check: any run of N consecutive words shared between our notes/guides and a source's raw text.
Usage: python3 -I tools/check_overlap.py /path/to/raw [N=12]
Titles and headings legitimately recorded as metadata are reported separately (they're short, factual and attributed)."""
import glob, json, re, sys
RAW = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 12
norm = lambda t: re.findall(r"[a-z0-9']+", t.lower())
src = {}
for p in glob.glob(f"{RAW}/*.txt"):
    w = norm(open(p).read())
    src[p.split("/")[-1][:-4]] = {" ".join(w[i:i + N]) for i in range(len(w) - N + 1)}
allsrc = set().union(*src.values())
titles = set()
for f in glob.glob("notes/*.json"):
    for a in json.load(open(f)).get("articles", []):
        titles.add(" ".join(norm(a["title"])))
        for s in a.get("sections_read", []):
            titles.add(" ".join(norm(s)))
hits = []
for f in sorted(glob.glob("guides/*.md") + glob.glob("notes/*.json") + glob.glob("playbooks/*.json") + glob.glob("*.md")):
    w = norm(open(f).read())
    for i in range(len(w) - N + 1):
        g = " ".join(w[i:i + N])
        if g in allsrc and not any(g in t for t in titles):
            hits.append((f, g))
seen = set()
uniq = [(f, g) for f, g in hits if not (g in seen or seen.add(g))]
print(f"{len(uniq)} shared {N}-word runs outside titles/headings")
for f, g in uniq[:40]:
    print(f, "::", g)
