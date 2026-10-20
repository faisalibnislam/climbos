"""Validate the blog-research addition. Standard library only; no network.

Checks: JSON syntax; unique IDs; playbook required fields and status; source and
concept references; repo paths named in extends_existing; internal Markdown
links; worked-example arithmetic (independent Python recomputation, and
ClimbOS's own TypeScript calculators when `npx tsx` is available).

Run from the repo root: python3 docs/growth-expansion/blog-research/tools/validate.py
Writes validation.json next to README.md and exits non-zero on any failure.
"""
import glob
import json
import math
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
results = []


def check(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": detail})


def close(a, b, tol=0.01):
    return abs(a - b) <= tol


# ---- 1. JSON syntax ----
docs = {}
for path in sorted(glob.glob(os.path.join(HERE, "**", "*.json"), recursive=True)):
    rel = os.path.relpath(path, HERE)
    if rel == "validation.json":
        continue
    try:
        with open(path) as fh:
            docs[rel] = json.load(fh)
        check(f"json:{rel}", True)
    except Exception as e:  # noqa: BLE001
        check(f"json:{rel}", False, str(e)[:200])

reg = docs.get("source_registry.json", {})
cat = docs.get("playbooks/catalog.json", {})
cases = docs.get("evaluations/cases.json", {}).get("cases", [])
playbooks = {k: v for k, v in docs.items() if k.startswith("playbooks/BRP-")}

# ---- 2. Unique IDs ----
article_ids = [a["id"] for a in reg.get("articles", [])]
finding_ids = [f["id"] for a in reg.get("articles", []) for f in a.get("findings", [])]
concept_ids = [c["id"] for k in ("GU", "EV", "CH", "DS", "EXP") for c in docs.get(f"notes/{k}.json", {}).get("concepts", [])]
pb_ids = [p["id"] for p in playbooks.values()]
case_ids = [c["id"] for c in cases]
for label, ids in (("articles", article_ids), ("findings", finding_ids), ("concepts", concept_ids), ("playbooks", pb_ids), ("cases", case_ids)):
    dup = sorted({x for x in ids if ids.count(x) > 1})
    check(f"unique:{label}", not dup, f"{len(ids)} ids" + (f"; duplicates {dup}" if dup else ""))
check("catalog:matches_files", sorted(p["id"] for p in cat.get("playbooks", [])) == sorted(pb_ids), f"{len(pb_ids)} playbooks")
for p in cat.get("playbooks", []):
    check(f"catalog:file:{p['id']}", os.path.exists(os.path.join(HERE, "playbooks", p["file"])))

# ---- 3. Playbook contracts ----
REQUIRED = ["id", "version", "decision_task", "business_types", "lifecycle_stages", "applies_when", "exclusions", "required_inputs", "evidence_requirements", "missing_data_behavior", "decision_branches", "implementation_steps", "dependencies", "cash_and_labor_requirements", "metrics", "guardrails", "stop_conditions", "review_triggers", "source_references", "hypothetical_evaluation_cases", "status"]
fset = set(finding_ids)
cset = set(concept_ids)
for rel, p in playbooks.items():
    missing = [k for k in REQUIRED if k not in p or p[k] in (None, "", [], {})]
    check(f"playbook:fields:{p.get('id')}", not missing, "missing/empty: " + ", ".join(missing) if missing else "all required fields present")
    check(f"playbook:status:{p.get('id')}", p.get("status") == "proposed_reference", p.get("status", ""))
    bad = [r for r in p.get("source_references", []) if r not in fset]
    check(f"playbook:source_refs:{p.get('id')}", not bad, f"{len(p.get('source_references', []))} refs" + (f"; unresolved {bad}" if bad else ""))
    badc = [c for c in p.get("concepts", []) if c not in cset]
    check(f"playbook:concepts:{p.get('id')}", not badc, ", ".join(badc))
    for e in p.get("extends_existing", []):
        path = e.split(" ")[0]
        if "/" in path:
            check(f"playbook:extends_path:{p['id']}:{path}", os.path.exists(os.path.join(REPO, path)), path)
    for ev in p.get("hypothetical_evaluation_cases", []):
        check(f"playbook:eval_labelled:{p['id']}:{ev['id']}", ev.get("label") == "hypothetical" and "inputs_hypothetical" in ev)

# ---- 4. Case references ----
for c in cases:
    check(f"case:refs:{c['id']}", c.get("playbook") in pb_ids and c.get("concept") in cset and all(r in fset for r in c.get("source_refs", [])) and c.get("status") == "not_run_against_engine")

# ---- 5. Internal Markdown links ----
md_files = glob.glob(os.path.join(HERE, "**", "*.md"), recursive=True) + [os.path.join(HERE, "..", "MASTER_INDEX.md")]
link_re = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
for md in md_files:
    with open(md) as fh:
        text = fh.read()
    for target in link_re.findall(text):
        if re.match(r"^(https?:|mailto:|#)", target):
            continue
        path = target.split("#")[0]
        if not path:
            continue
        ok = os.path.exists(os.path.normpath(os.path.join(os.path.dirname(md), path)))
        if not ok or "blog-research" in md or "blog-research" in path:
            check(f"link:{os.path.relpath(md, HERE)}->{target}", ok)

# ---- 6. Worked examples (independent recomputation) ----
def payback_churn(cac, cm, c):
    x = 1 - cac * c / cm
    return math.log(x) / math.log(1 - c) if x > 0 else None


def value12(cm, c, h=12):
    return cm * (1 - (1 - c) ** h) / c


cm = 100 * 0.8
check("calc:DS-EX1 simple payback 6", close(600 / 100, 6))
check("calc:DS-EX1 gm payback 7.5", close(600 / cm, 7.5))
check("calc:DS-EX1 churn payback 8.37", close(payback_churn(600, cm, 0.03), 8.37))
check("calc:DS-EX1 value_12m 816.42", close(value12(cm, 0.03), 816.42))
mrr = 80 * 50 + 20 * 300
check("calc:DS-EX2 churn 11% / mrr churn 8% / net -2%", close(11 / 100, 0.11, 1e-9) and close((10 * 50 + 300) / mrr, 0.08, 1e-9) and close((800 - 1000) / mrr, -0.02, 1e-9))
check("calc:DS-EX3 simple LTV 2666.67, ratio 4.44, value12/CAC 1.36", close(80 / 0.03, 2666.67) and close(80 / 0.03 / 600, 4.44) and close(value12(80, 0.03) / 600, 1.36))
r = 1.01 * 0.97
check("calc:DS-EX4 value with expansion 859.75", close(80 * (1 - r ** 12) / (1 - r), 859.75))
cum = [10 * (-600 * M + 40 * M * (M - 1)) for M in range(1, 25)]
trough = min(cum)
check("calc:DS-EX5 trough -25600 at month 8, breakeven month 16", trough == -25600 and cum.index(trough) + 1 == 8 and next(i + 1 for i, v in enumerate(cum) if i > 7 and v >= 0) == 16)
check("calc:DS-EX6 CAC-aware price floor 73.49", close(600 * 0.03 / (0.8 * (1 - 0.97 ** 12)), 73.49))
check("calc:DS-EX7 CAC 150 / 400 / 425", close(900 / 6, 150) and close((900 + 30 * 50) / 6, 400) and close((900 + 1500 + 150) / 6, 425))
check("calc:DS-EX8 media CAC 100, break-even CPC 6.53", close(0.8 / (0.04 * 0.2), 100) and close(816.42 * 0.04 * 0.2, 6.53))
chi = 2 * (30 ** 2) / 200
check("calc:SRM 230/170 chi2 9, p 0.0027", close(chi, 9, 1e-9) and close(math.erfc(math.sqrt(chi / 2)), 0.0027, 0.0001))
pool = 30 / 240
z = (18 / 120 - 12 / 120) / math.sqrt(pool * (1 - pool) * (2 / 120))
check("calc:two-proportion 18/120 vs 12/120 p 0.2416", close(math.erfc(abs(z) / math.sqrt(2)), 0.2416, 0.0005))

# ---- 7. ClimbOS's own calculators agree (optional; needs npx tsx) ----
try:
    out = subprocess.run(["npx", "tsx", os.path.join(HERE, "tools", "check_engine_math.ts")], cwd=REPO, capture_output=True, text=True, timeout=180, env={**os.environ, "TMPDIR": os.environ.get("TMPDIR", "/tmp")})
    eng = json.loads(out.stdout.strip().splitlines()[-1])
    check("engine:payback_with_churn 8.37", close(eng["ex1_payback_churn"], 8.37))
    check("engine:value_12m 816.42", close(eng["ex1_value_12m"], 816.42))
    check("engine:cacFull other=0 vs 150 (400 vs 425)", close(eng["ex7_cac_now"], 400) and close(eng["ex7_cac_full"], 425))
    check("engine:breakeven_cpc 6.53", close(eng["ex8_breakeven_cpc"], 6.53))
    check("engine:sampleRatio 230/170 p 0.0027 (passes the 0.001 block, as BACKLOG #2 says)", close(eng["srm_230_170"], 0.0027, 0.0001))
    check("engine:sampleRatio 9000/1000 mismatch", eng["srm_9000_1000"] is True)
    check("engine:compareRates 18/120 vs 12/120 p 0.2416", close(eng["rates_18_12"], 0.2416, 0.0005))
except Exception as e:  # noqa: BLE001
    check("engine:cross_check_ran", False, f"not run: {str(e)[:160]}")

failed = [x for x in results if not x["ok"]]
summary = {"edition": "2026-10-20", "checks": len(results), "failed": len(failed), "results": results}
with open(os.path.join(HERE, "validation.json"), "w") as fh:
    json.dump(summary, fh, indent=1)
print(f"{len(results)} checks, {len(failed)} failed")
for x in failed:
    print("FAIL", x["check"], x["detail"])
sys.exit(1 if failed else 0)
