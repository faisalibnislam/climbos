# Validation report (2026-10-20)

This records what was actually checked. Raw results are in [validation.json](validation.json). Re-run from the repo root:
- `python3 docs/growth-expansion/book-research/tools/validate.py`
- Add `BOOK_TEXT_DIR=<private extracted texts>` to include the copied-prose check.

**Result: 371 of 371 checks passed.**

## Reading and source accuracy

| Check | How | Result |
|---|---|---|
| Files are the stated books | Title and copyright pages, OPF metadata, SHA-256 per file (README inventory) | 9 books identified. Corrections on record: BK13 is 2018, not 2017. BK15 is the 2014 first edition, not 2015. BK10 is the 2014 updated e-book, not 2010 OUP. BK12 is a 2024 reprint of 2013 content. |
| Readable text | EPUB text by spine file and element range. BK12 via PDFKit. BK11 via on-device Apple Vision OCR (no text layer). | All substantive chapters read. Unreadable figures, blank pages and OCR-weak tables are listed in the README and each guide. |
| Duplicates | Hash comparison across `docs/reference-books/` and `docs/reference-books-2/` | None among the nine. The Kohavi EPUB in `reference-books-2` is identical to the BK06 copy. |
| Locators | Every finding has a locator. PDF page numbers checked against page counts (BK11: 254, BK12: 439). | Pass. Printed-to-PDF offsets are recorded where known (BK11 body: printed + 18). |
| Book arithmetic errors found | Recomputed by the reading agents | BK10 Table 10.2 (14.3% vs printed 10%). BK12: "40%" vs its table's 67%, $6.06 vs $6.00, inconsistent churn thresholds. BK09b: the 2–3x short-contract rule fails its own example (1.43x). |

## Structure and references (`tools/validate.py`)

- **JSON:** every file parses.
- **Unique IDs:**
  - 392 findings
  - 77 frameworks
  - 27 playbooks
  - 213 cases
- **Catalog:** matches the playbook files.
- **Playbooks:**
  - **Fields:** all 25 required fields are filled, including applicability, exclusions, missing-data behaviour, branches, guardrails, stop and review conditions, rule classes, sources and version.
  - **Status:** `proposed_reference`.
- **Rule classes:** every proposed rule (247) has one of the six classes.
- **References:**
  - Playbook sources resolve to findings.
  - Member frameworks resolve, and every framework sits in exactly one playbook.
  - Framework author references resolve.
  - 70 `versions_existing` repo paths exist.
  - The 24 PB and BRP IDs they name exist in `shared/playbooks/contracts.ts` or `blog-research/playbooks/`.
- **Evaluation fixtures:**
  - Prompt and key IDs match one-to-one (213).
  - No grading fields appear in `prompts.json` or the notes.
  - All cases are labelled hypothetical and `not_run_against_engine`.
  - Each case maps to a playbook.
  - Case mix: 71 positive, 50 negative, 57 blind-application traps, 22 sparse or conflicting, 13 legitimate alternatives.
- **Links:** 456 internal Markdown links resolve, including the new section in `../MASTER_INDEX.md`. `../manifest.json` was updated for that file's new size and hash.
- **Skill diffs:** all 25 pass `git apply --check` against HEAD. None are applied.

## Example calculations

There are 238 numeric checks across the cases.

| Method | Count |
|---|---|
| Recomputed from the formula text by `tools/numcheck.py` (safe arithmetic parser) | 225 |
| Recomputed from an explicit expression in `tools/numcheck_manual.json` (formula text was prose) | 11 |
| Taken from ClimbOS's own code via `npx tsx`: `sampleSize({baseline: 0.4, minDetectable: 0.15}).perArm` = 173; `WARMUP.start` = 10 | 2 |
| Failures | 0 |

## Copied prose

`tools/check_overlap.py` compared every 12-word run in the guides, notes, playbooks, registry and top-level docs (79 files) with the full extracted text of all nine books.

- There are 32 shared runs, and all are titles, subtitles or chapter headings recorded as attributed metadata.
- No book prose is reproduced.
- Book texts are kept privately and are never committed.

## Not checked

- **Engine behaviour:** the 213 cases haven't been run against ClimbOS (no paid runs approved). **No claim is made that the engine passes them.**
- **Close paraphrase:** shared wording below 12 words isn't ruled out.
- **Currency:** dated tools, platforms and benchmarks are marked dated. They weren't re-verified against current primary sources.
- **Skill quality:** the 25 diffs apply cleanly, but their effect on plans is unmeasured until a bench comparison runs.
- **Repo-wide tests:** no runtime code changed in this addition, so the unit suite wasn't re-run for it.
