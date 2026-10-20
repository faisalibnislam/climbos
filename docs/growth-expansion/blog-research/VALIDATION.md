# Validation report (2026-10-20)

This records what was actually checked. Raw results are in [validation.json](validation.json); re-run with `python3 docs/growth-expansion/blog-research/tools/validate.py` from the repo root.

## Source access and finding accuracy

| Check | How | Result |
|---|---|---|
| Pages are real and readable | Raw HTML of all 43 recorded articles fetched with Python's standard library (`tools/fetch_raw.py`). Growth Unhinged posts came from the public Substack archive. | 43 of 43 fetched, none blocked. Word counts are in [notes/raw_fetch_log.json](notes/raw_fetch_log.json). growthunhinged.com itself was not fetched (bot check), as noted in the README. |
| Findings match the pages | `tools/check_findings.py`: every number in each finding's summary must appear in that article's raw text, and key-term overlap is measured. | 191 findings. **All numbers found** after fixing a tag-stripping bug that had hidden "p < 0.0005" (confirmed in the raw HTML). 11 findings had low word overlap because they're paraphrases. |
| Low-overlap findings | Checked by hand against the raw text: GU-08-F4 ("Plus" tier naming), EV-02-F6 (3 screens, 9 questions, at most 10% drop-off), DS-06-F1/F2 (2.5% monthly expansion simulation), EXP-04-F2 (p < 0.0005 threshold) | Supported. The other low-overlap items (CH paraphrases of process advice) weren't each hand-checked. |
| Paywalls and truncation | Recorded per article in `access` / `access_notes` | 4 Elena Verna posts paywalled past their intros (incl. the requested starting post); Growth Unhinged paid sections unread; image-only formulas and charts unread (Skok, Copyhackers, Verna) |

| No copied prose | `tools/check_overlap.py`: every run of 12 consecutive words in the guides, notes, playbooks and top-level docs compared with the raw text of all 43 articles | 24 shared runs, **all titles, author lists or URLs** (attributed metadata). No article prose reproduced. |

Raw page text is not committed (copyright). The tools re-create it locally.

## Structure and references (`tools/validate.py`)

- **JSON syntax:** every `.json` file in this folder parses.
- **Unique IDs:**
  - 43 articles
  - 191 findings
  - 33 concepts
  - 23 playbooks
  - 33 cases
- **Catalog:** lists exactly the playbook files present.
- **Playbook fields:** each playbook has every required field filled, and status `proposed_reference`.
  - Required: id, version, decision_task, business_types, lifecycle_stages, applies_when, exclusions, required_inputs, evidence_requirements, missing_data_behavior, decision_branches, implementation_steps, dependencies, cash_and_labor_requirements, metrics, guardrails, stop_conditions, review_triggers, source_references, hypothetical_evaluation_cases, status.
- **Source references:** each playbook's `source_references` resolve to finding IDs in the registry, and its `concepts` resolve to research concepts.
- **Repo paths:** every path named in `extends_existing` exists.
- **Evaluation cases:**
  - labelled hypothetical;
  - reference an existing playbook and concept;
  - cite resolvable findings;
  - marked `not_run_against_engine`.
- **Internal links:** all Markdown links in this folder, plus the new section in `../MASTER_INDEX.md`, resolve.

## Example calculations

Recomputed independently in Python and, where ClimbOS has a calculator, with ClimbOS's own code (`tools/check_engine_math.ts` via `npx tsx`):

| Example | Expected | Python | ClimbOS calculator |
|---|---|---|---|
| DS-EX1 payback: simple / gross-margin / churn-weighted | 6 / 7.5 / 8.37 months | ✓ | `paybackSimple`, `paybackWithChurn` ✓ |
| DS-EX1 12-month value | 816.42 | ✓ | `allowableCac` ✓ |
| DS-EX2 customer churn, revenue churn, net churn | 11% / 8% / −2% | ✓ | n/a (no revenue churn in ClimbOS yet; BACKLOG #10) |
| DS-EX3 simple LTV, LTV:CAC, 12-month value:CAC | 2,666.67 / 4.44 / 1.36 | ✓ | n/a |
| DS-EX4 12-month value with 1% compound expansion | 859.75 | ✓ | n/a (BACKLOG #10) |
| DS-EX5 cash trough (10 customers a month) | −25,600 at month 8, breakeven month 16 | ✓ | n/a (BACKLOG #12) |
| DS-EX6 acquisition-aware price floor | 73.49 / month | ✓ | n/a (BACKLOG #13) |
| DS-EX7 cost per customer: media / ClimbOS today / fully loaded | 150 / 400 / 425 | ✓ | `cacFull` ✓ (confirms the gap at `economics.ts:203`) |
| DS-EX8 media CAC, break-even cost per click | 100 / 6.53 | ✓ | `breakevenCpc` ✓ |
| Split check 230/170 on 50/50 | χ² = 9, p = 0.0027 | ✓ | `sampleRatio` ✓ (passes the 0.001 block today; BACKLOG #2) |
| Split check 9,000/1,000 | mismatch | n/a | `sampleRatio` ✓ |
| Two-proportion 18/120 vs 12/120 | p = 0.2416 | ✓ | `compareRates` ✓ (BACKLOG #1) |

## Not checked

- **Engine behaviour:** whether the ClimbOS engine handles the 33 cases well. They have not been run (owner chose build without paid runs). **No claim is made that the engine passes them.**
- **Near-copying:** close paraphrase below 12 words. The 12-word check rules out copied passages, not close paraphrase.
- **Currency:** whether author claims are still current after the retrieval date. Volatile items are marked dated.
- **Links outside this folder:** external URLs weren't re-fetched by the validator (they were fetched once, as logged).
- **Existing pack integrity:** the pack's own `integration/validate_pack.py` wasn't re-run. Only the `MASTER_INDEX.md` entry in `../manifest.json` was updated (new size and hash) after adding the link section.
