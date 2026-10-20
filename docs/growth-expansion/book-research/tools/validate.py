"""Validate the book-research addition. Standard library only; no network.

Checks: JSON syntax; unique IDs; playbook required fields, status and rule classes; references
(findings, frameworks, cases, playbooks, repo paths, PB/BRP ids); prompt/expected separation;
internal Markdown links; numeric checks (independent recomputation plus ClimbOS's own TypeScript
for engine-derived values when `npx tsx` is available); skill diffs apply; PDF page locators in range;
copied-prose check when the private book texts are available (BOOK_TEXT_DIR).

Run from the repo root: python3 docs/growth-expansion/book-research/tools/validate.py
Writes validation.json next to README.md and exits non-zero on any failure.
"""
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(HERE, "tools"))
from numcheck import _ev, check as numcheck  # noqa: E402
import ast  # noqa: E402

results = []


def check(name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": detail})


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
prompts = docs.get("evaluations/prompts.json", {}).get("cases", [])
expected = docs.get("evaluations/expected.json", {}).get("cases", [])
playbooks = {k: v for k, v in docs.items() if k.startswith("playbooks/BKP-")}
notes = {k: v for k, v in docs.items() if k.startswith("notes/")}

# ---- 2. Unique IDs ----
finding_ids = [f["id"] for b in reg.get("books", []) for f in b.get("findings", [])]
fw_ids = [f["id"] for n in notes.values() for f in n["frameworks"]]
pb_ids = [p["id"] for p in playbooks.values()]
case_ids = [c["id"] for c in prompts]
for label, ids in (("findings", finding_ids), ("frameworks", fw_ids), ("playbooks", pb_ids), ("cases", case_ids)):
    dup = sorted({x for x in ids if ids.count(x) > 1})
    check(f"unique:{label}", not dup, f"{len(ids)} ids" + (f"; duplicates {dup}" if dup else ""))
check("catalog:matches_files", sorted(p["id"] for p in cat.get("playbooks", [])) == sorted(pb_ids), f"{len(pb_ids)} playbooks")
for p in cat.get("playbooks", []):
    check(f"catalog:file:{p['id']}", os.path.exists(os.path.join(HERE, "playbooks", p["file"])))

# ---- 3. Playbook fields ----
REQUIRED = ["id", "version", "decision_task", "business_types", "lifecycle_stages", "applies_when", "exclusions", "required_inputs",
            "evidence_requirements", "missing_data_behavior", "decision_branches", "implementation_steps", "dependencies",
            "cash_and_labor_requirements", "metrics", "guardrails", "alternatives_when_constrained", "stop_conditions", "review_triggers",
            "rule_classes", "versions_existing", "source_references", "hypothetical_evaluation_cases", "status", "origin"]
CLASSES = {"external_requirement", "missing_prerequisite", "economic_feasibility", "strategic_preference", "contextual_heuristic", "unknown_to_investigate"}
fset, fwset, caseset = set(finding_ids), set(fw_ids), set(case_ids)
contracts = open(os.path.join(REPO, "shared/playbooks/contracts.ts")).read()
brp_ids = {os.path.basename(p)[:6] for p in glob.glob(os.path.join(REPO, "docs/growth-expansion/blog-research/playbooks/BRP-*.json"))}
covered_fw = set()
for rel, p in sorted(playbooks.items()):
    empty = [k for k in REQUIRED if k not in p or p[k] in ("", [], {}, None)]
    check(f"playbook:fields:{p['id']}", not empty, f"empty/missing: {empty}" if empty else "")
    check(f"playbook:status:{p['id']}", p.get("status") == "proposed_reference")
    bad_cls = [c for c in p.get("rule_classes", {}) if c not in CLASSES]
    check(f"playbook:rule_classes:{p['id']}", not bad_cls, str(bad_cls))
    bad_src = [r for r in p.get("source_references", []) if r not in fset]
    check(f"playbook:sources:{p['id']}", not bad_src, f"{len(p.get('source_references', []))} refs" + (f"; unresolved {bad_src[:5]}" if bad_src else ""))
    bad_fw = [m for m in p.get("member_frameworks", []) if m not in fwset]
    covered_fw.update(p.get("member_frameworks", []))
    check(f"playbook:frameworks:{p['id']}", not bad_fw, str(bad_fw))
    bad_case = [c for c in p.get("hypothetical_evaluation_cases", []) if c not in caseset]
    check(f"playbook:cases:{p['id']}", not bad_case, f"{len(p.get('hypothetical_evaluation_cases', []))} cases")
    for v in p.get("versions_existing", []):
        path = v.split(" ")[0]
        if "/" in path:
            check(f"playbook:path:{p['id']}:{path}", os.path.exists(os.path.join(REPO, path)))
        for pb in re.findall(r"\bPB-[a-z-]+[a-z]", v):
            check(f"playbook:pb_id:{p['id']}:{pb}", f'id: "{pb}"' in contracts, "exists in shared/playbooks/contracts.ts")
        for brp in re.findall(r"\bBRP-\d\d", v):
            check(f"playbook:brp_id:{p['id']}:{brp}", brp in brp_ids)
check("frameworks:all_in_a_playbook", covered_fw == fwset, f"unassigned: {sorted(fwset - covered_fw)}")
# rule classes in notes
bad = [(f["id"], r.get("class")) for n in notes.values() for f in n["frameworks"] for r in f.get("proposed_rules", []) if r.get("class") not in CLASSES]
check("notes:rule_classes_valid", not bad, str(bad[:5]))
# framework author_refs resolve
bad = [(f["id"], r) for n in notes.values() for f in n["frameworks"] for r in f.get("author_refs", []) if r not in fset]
check("notes:author_refs_resolve", not bad, str(bad[:5]))

# ---- 4. Evaluation fixtures: separation and labels ----
check("evals:ids_match", sorted(case_ids) == sorted(c["id"] for c in expected), f"{len(case_ids)} prompts, {len(expected)} keys")
leak = [c["id"] for c in prompts if any(k in c for k in ("expected_behavior", "hard_failures", "numeric_checks"))]
check("evals:no_answers_in_prompts", not leak, str(leak[:5]))
leak = [f["id"] for n in notes.values() for f in n["frameworks"] if "eval_cases" in f]
check("evals:no_answers_in_notes", not leak, str(leak[:5]))
check("evals:hypothetical_and_not_run", all(c.get("hypothetical") is True and c.get("status") == "not_run_against_engine" for c in prompts))
check("evals:playbook_resolves", all(c.get("playbook") in pb_ids for c in prompts))
types = {}
for c in prompts:
    types[c["case_type"]] = types.get(c["case_type"], 0) + 1
check("evals:case_type_mix", all(types.get(t, 0) > 0 for t in ("positive", "negative", "blind_application_trap", "sparse_or_conflicting", "alternative_ok")), json.dumps(types))

# ---- 5. Numeric checks ----
manual = {e["formula"]: e for e in json.load(open(os.path.join(HERE, "tools", "numcheck_manual.json")))["entries"]}
engine_needed = []
counts = {"auto": 0, "manual": 0, "engine": 0, "fail": 0}
fails = []
for c in expected:
    for n in c.get("numeric_checks", []):
        f, exp = str(n["formula"]), n.get("expected")
        if not isinstance(exp, (int, float)):
            counts["fail"] += 1
            fails.append((c["id"], f, "non-numeric expected"))
            continue
        st, _ = numcheck(f, float(exp))
        if st == "ok":
            counts["auto"] += 1
            continue
        m = manual.get(f)
        if m and "expr" in m:
            v = _ev(ast.parse(m["expr"], mode="eval"))
            if abs(v - exp) <= max(0.0051, abs(exp) * 0.01):
                counts["manual"] += 1
                continue
        if m and "engine" in m:
            engine_needed.append((c["id"], m, exp))
            continue
        counts["fail"] += 1
        fails.append((c["id"], f, st))
# engine-derived values via ClimbOS's own code
if engine_needed:
    ts = ("import { sampleSize } from './shared/analysis/decisions';\nimport { WARMUP } from './shared/outbound/sending';\n"
          "console.log(JSON.stringify({ss: sampleSize({baseline: 0.4, minDetectable: 0.15}).perArm, warm: WARMUP.start}));\n")
    tmp = os.path.join(REPO, ".book-research-engine-check.ts")
    try:
        open(tmp, "w").write(ts)
        env = dict(os.environ)
        if " " in env.get("TMPDIR", ""):  # tsx's IPC pipe can't live under a path with spaces
            env["TMPDIR"] = "/private/tmp/claude-501" if os.path.isdir("/private/tmp/claude-501") else "/tmp"
        out = subprocess.run(["npx", "tsx", tmp], cwd=REPO, capture_output=True, text=True, timeout=180, env=env)
        vals = json.loads(out.stdout.strip().splitlines()[-1])
        got = {"sampleSize": vals["ss"], "WARMUP": vals["warm"]}
        for cid, m, exp in engine_needed:
            key = "sampleSize" if "sampleSize" in m["engine"] else "WARMUP"
            ok = got[key] == exp == m["expected_from_code"]
            counts["engine" if ok else "fail"] += 1
            if not ok:
                fails.append((cid, m["formula"], f"engine gave {got[key]}"))
    except Exception as e:  # noqa: BLE001
        check("numeric:engine_available", False, f"npx tsx failed: {str(e)[:120]}")
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
check("numeric:all_checks_recompute", counts["fail"] == 0, json.dumps(counts) + (f"; failures {fails[:5]}" if fails else ""))

# ---- 6. Internal Markdown links ----
md_files = glob.glob(os.path.join(HERE, "**", "*.md"), recursive=True) + [os.path.join(HERE, "..", "MASTER_INDEX.md")]
broken = []
nlinks = 0
for md in md_files:
    text = open(md).read()
    if md.endswith("MASTER_INDEX.md"):
        text = text[text.find("## Book research"):] if "## Book research" in text else ""
    for link in re.findall(r"\]\(([^)\s]+)\)", text):
        if re.match(r"^(https?:|mailto:|#)", link):
            continue
        nlinks += 1
        target = os.path.normpath(os.path.join(os.path.dirname(md), link.split("#")[0]))
        if not os.path.exists(target):
            broken.append(f"{os.path.relpath(md, HERE)} -> {link}")
check("links:internal_resolve", not broken, f"{nlinks} links" + (f"; broken {broken[:8]}" if broken else ""))
check("master_index:section_present", "## Book research" in open(os.path.join(HERE, "..", "MASTER_INDEX.md")).read())

# ---- 7. Skill diffs apply ----
for d in sorted(glob.glob(os.path.join(HERE, "skill-proposals", "*.diff"))):
    r = subprocess.run(["git", "apply", "--check", "-p1", d], cwd=REPO, capture_output=True, text=True)
    check(f"skill_diff:applies:{os.path.basename(d)}", r.returncode == 0, r.stderr.strip()[:160])

# ---- 8. PDF page locators in range ----
PAGES = {"BK11": 254, "BK12": 439}
for b in reg.get("books", []):
    if b["reading_id"] in PAGES:
        bad = []
        for f in b["findings"]:
            for n in re.findall(r"(?:PDF\s*)?pp?\.?\s*(\d{1,4})", f.get("locator", "")):
                if int(n) > PAGES[b["reading_id"]]:
                    bad.append((f["id"], n))
        check(f"locators:pdf_pages_in_range:{b['reading_id']}", not bad, str(bad[:5]))
missing_loc = [f["id"] for b in reg.get("books", []) for f in b["findings"] if not f.get("locator")]
check("locators:every_finding_has_one", not missing_loc, str(missing_loc[:5]))

# ---- 9. Copied prose (needs the private book texts) ----
text_dir = os.environ.get("BOOK_TEXT_DIR")
if text_dir and os.path.isdir(text_dir):
    r = subprocess.run([sys.executable, os.path.join(HERE, "tools", "check_overlap.py"), text_dir], capture_output=True, text=True)
    try:
        rep = json.loads(r.stdout)
        check("overlap:no_copied_prose", rep["non_title_runs"] == 0, json.dumps({k: rep[k] for k in ("files", "runs", "non_title_runs")}) + (f"; {rep['examples'][:3]}" if rep["non_title_runs"] else ""))
    except Exception as e:  # noqa: BLE001
        check("overlap:no_copied_prose", False, f"overlap tool failed: {r.stderr[:160] or e}")
else:
    check("overlap:skipped_no_book_text", True, "set BOOK_TEXT_DIR to the private extracted texts to run it")

ok = all(r["ok"] for r in results)
with open(os.path.join(HERE, "validation.json"), "w") as fh:
    json.dump({"ok": ok, "checks": len(results), "failed": [r for r in results if not r["ok"]], "results": results}, fh, indent=1)
    fh.write("\n")
print(f"{'OK' if ok else 'FAIL'}: {sum(r['ok'] for r in results)}/{len(results)} checks passed")
for r in results:
    if not r["ok"]:
        print("  FAIL", r["check"], r["detail"])
sys.exit(0 if ok else 1)
