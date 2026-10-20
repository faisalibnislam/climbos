# Blog and article research (edition 2026-10-20)

This adds knowledge to ClimbOS's growth library from five public sources: Growth Unhinged, Elena's Growth Scoop, Copyhackers, For Entrepreneurs and Microsoft's Experimentation Platform articles.

- **What it is:** original synthesis with attribution. No article text, templates or tables are reproduced.
- **What it isn't:** it changes no application code and authorizes no publishing, sending or spending.

## What's here

| Path | Contents |
|---|---|
| [source_registry.json](source_registry.json) | 43 article records: exact title, author, canonical URL, where it was actually read, published date when stated, retrieval date, access scope, sections read, findings (each typed and dated, with limitations), 62 not-read or excluded items, Skok's 17 formulas and 8 worked examples, and the experiment-check gaps found in ClimbOS |
| [guides/](guides/) | Five source-grounded guides, one per source. Each separates author guidance, reported cases, our interpretation and proposed ClimbOS rules, and sorts durable principles from dated material |
| [playbooks/](playbooks/) | 23 machine-readable playbooks (`status: proposed_reference`) and [catalog.json](playbooks/catalog.json). Each names the existing ClimbOS guidance it extends or versions |
| [RECONCILIATION.md](RECONCILIATION.md) | 17 disagreements (between sources, with the existing library, or with current code) and the conditions that decide which advice applies |
| [evaluations/cases.json](evaluations/cases.json) | 33 synthetic cases, labelled hypothetical, `not_run_against_engine` |
| [BACKLOG.md](BACKLOG.md) | Prioritized implementation work tied to verified file and line references |
| [VALIDATION.md](VALIDATION.md) and [validation.json](validation.json) | What was checked, and the results |
| [notes/](notes/) | The structured research notes each guide and playbook was built from, plus the raw-page fetch log |
| [tools/](tools/) | `build.py` (registry, playbooks, catalog, cases), `guides.py` (guides), `validate.py` (checks) and `check_engine_math.ts` (cross-check against ClimbOS calculators) |

## Coverage and access

| Source | Read | Access limits |
|---|---|---|
| **Growth Unhinged** (Kyle Poyar) | 8 posts: 2 full, 6 partial | growthunhinged.com (on beehiiv since 2026-01-12) returned a bot check to every tool; it was not bypassed. Posts were read from the publisher's public legacy Substack archive (kylepoyar.substack.com). Paid sections (most practical parts) were not read. The homepage and `/t/pricing` index and 2026 beehiiv-only posts were not accessed. |
| **Elena's Growth Scoop** (Elena Verna) | 8 public posts in full; 4 paid posts to the paywall | **The requested starting post, "5 of my favorite new retention techniques", is paywalled past its introduction; none of its techniques were read.** Two retention posts are sponsored by Churnkey. |
| **Copyhackers** | 8 articles and tutorial transcripts: 4 full, 4 partial | Charts and screenshots are images. Some transcripts have gaps. The clarity-sweep tutorial has no transcript. Paid courses (Copy School, 10x Sales Pages) and gated templates were not accessed. |
| **For Entrepreneurs** (David Skok) | 7 pages, all partial | Formulas and charts embedded as images were not readable. The expansion-LTV closed form is the commonly cited version, not checked against the image. Linked spreadsheets were not downloaded. |
| **Microsoft ExP** | 8 articles in full | The `/articles/page/2/` listing returned 404 (query pages used instead). No dedicated "pitfalls" or "decisions under uncertainty" article was found. One article lists no authors. |

**Retrieval date:** 2026-10-20 for all items. Publication dates are recorded only where the page states them. Many Copyhackers and Skok pages show no date, so `published` is null and any date hint from the URL is in `access_notes`.

**How the reading was verified:**
- The research was done with a fetch tool that can return processed page text.
- To meet the "read the actual articles" requirement, the raw HTML of all 43 pages was then fetched with Python's standard library. No page was blocked that way.
- Every finding's numbers and key terms were matched against the raw text. All numbers matched; a stripping error on one page was found and fixed.
- 11 findings with low word overlap (paraphrases) were spot-checked by hand.
- The raw text isn't committed (copyright); the fetch log is in [notes/raw_fetch_log.json](notes/raw_fetch_log.json). Details are in [VALIDATION.md](VALIDATION.md).

## How to read the material

- **Kinds of evidence:** each finding is typed: author guidance, reported case, survey or benchmark, dated tactic, formula or platform requirement. Each is also marked durable or dated.
- **Numbers:** author numbers (conversion ranges, churn targets, budget thresholds, rules such as LTV ≥ 3x) are kept as labelled, dated references. They're never universal thresholds or forecasts.
- **Interest:** sponsored or vendor-authored claims are flagged as interested evidence.
- **Arithmetic:** material calculations in the playbooks belong in deterministic code. Worked examples are recomputed by the validator and by ClimbOS's own calculators.

## How it connects to ClimbOS

- **Existing guidance:** each playbook's `extends_existing` names the guidance it builds on, e.g. `PB-pricing-test`, `PB-activation-repair`, `PB-lifecycle-email`, `diagnosis.ts`, `economics.ts`, the experiment checks, and the `voc-research`, `landing-pages` and `lifecycle-email` skills.
- **Overlaps:** overlapping guidance is versioned (marked "candidate v2"), not duplicated.
- **Engine priorities:** the biggest engine-level findings are in [BACKLOG.md](BACKLOG.md):
  - experiment outcomes can claim incremental results without a significant test;
  - cost per customer omits non-media costs;
  - "activated" counts setup;
  - the split check has no warning band;
  - harm stops are blocked as peeking.

## Not included

- Raw article text, images, templates or tables.
- Paid or private newsletter content.
- Completed courses.
- Any claim that the ClimbOS engine passed these cases: they haven't been run.
