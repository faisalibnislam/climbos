# Book research: nine owner-supplied books (BK07–BK15)

Edition 2026-10-20, against `growth-engine-v2` at `1321d8e`. Status: **proposed reference**. This is reference material, not authorization for external actions.

It follows the same layers as the rest of the library:
- **Skills** carry expert reasoning. Here they are proposed diffs only, not applied.
- **Playbooks** carry structured applicability (BKP-01..27).
- **Plays** are written per business by the engine and are out of scope here.

## Contents

| Path | What |
|---|---|
| [guides/](guides/) | One source-grounded guide per book. Each covers frameworks, rule classes, links to the existing library, dated benchmarks, disagreements and gaps. |
| [playbooks/](playbooks/) + [catalog.json](playbooks/catalog.json) | 27 structured playbooks merging all 77 frameworks. Each lists the existing PB-*/BRP-* guidance it versions. |
| [skill-proposals/](skill-proposals/README.md) | 25 skill revisions as `git apply`-ready diffs, each with a rationale table. **Not applied.** |
| [RECONCILIATION.md](RECONCILIATION.md) | Disagreements with the existing library and between books, what decides each, and the rule-class policy. |
| [evaluations/prompts.json](evaluations/prompts.json) / [expected.json](evaluations/expected.json) | 213 synthetic cases. Prompts and grading keys are in separate files. |
| [BACKLOG.md](BACKLOG.md) | 46 runtime-code items verified against the repo, with file:line evidence. **Proposed only; nothing implemented here.** |
| [VALIDATION.md](VALIDATION.md) | What was checked, and what wasn't. |
| [source_registry.json](source_registry.json) / [notes/](notes/) | Book identities, coverage records, 392 findings with locators, and framework records. |
| [tools/](tools/) | `build.py`, `validate.py`, `check_overlap.py`, `numcheck.py`. Standard-library Python; no network. |

## Book inventory

All files are in `docs/reference-books/`, gitignored, and never committed. "Hash" is the SHA-256 prefix.

| ID | Title (author) | Edition / publisher / year | Format | Hash | Watermark | Extraction |
|---|---|---|---|---|---|---|
| BK07 | *7 Powers* (Hamilton Helmer) | No edition stated; Deep Strategy LLC, 2016; ISBN 978-0-9981163-2-7 | EPUB | 8d08c05c83874b3e | OceanofPDF marks | Good prose. All figures absent from the file. |
| BK08 | *Forget the Funnel* (Georgiana Laudi, Claire Suellentrop) | First edition, 2023; ISBN 978-1-5445-4224-9. Publisher uncertain: Elevate LP in the OPF, Lioncrest logo in the package. | EPUB | 0266cdb079ddbd78 | OceanofPDF marks | Good. 9 figures are images. External workbook not included. |
| BK09 | *Founding Sales* (Peter Kazanjy) | Self-published, 2020; ISBN 978-1-7345051-0-8 (e-book) | EPUB | 525fd2f03e33c6ab | OceanofPDF marks | Good text. Slides, screenshots and charts are images. Read by two agents: BK09a covers the Introduction and Ch 1–6; BK09b covers Ch 7–13 and the Conclusion. |
| BK10 | *How Brands Grow* (Byron Sharp) | Updated e-book (BookBaby build 2014; original OUP 2010); ISBN 9781483534701 | EPUB | a3b333155e81cfef | None | Good. Tables are text, charts are images. The file has no Ch 13; it jumps from 12 to the FAQ. |
| BK11 | *How Brands Grow Part 2* (Jenni Romaniuk, Byron Sharp) | First edition, OUP Australia & NZ, 2016; ISBN 9780195596267 | PDF (scanned) | 06574135e0b9026a | Library stamps (Qatar National Library), no piracy marks | Fair. No text layer; read through on-device Apple Vision OCR. Prose is clean; tables and charts are unreliable and weren't used for numbers. |
| BK12 | *Lean Analytics* (Alistair Croll, Benjamin Yoskovitz) | First edition (2013 content); 2024 O'Reilly softcover reprint; ISBN 978-1-098-16818-6 | PDF | 971e5091d2c43483 | None | Good. 24 blank separator pages. Four figure pages were OCR'd; other figures are captions only. |
| BK13 | *Making Websites Win* (Karl Blanks, Ben Jesson) | E-book; copyright page says **2018** (not 2017); publisher not named; ISBN 978-1-5445-0052-2 | EPUB | 51ace5b449b9edab | None | Good text. All 127 images (wireframes, screenshots, templates) are unreadable. |
| BK14 | *Sales Pitch* (April Dunford) | No edition stated; Ambient Press, 2023; ISBN 9781999023034 | EPUB | 64beff83fb8eefb4 | OceanofPDF marks | Good. Figures 1–3 are images. |
| BK15 | *Traction* (Gabriel Weinberg, Justin Mares) | First edition hardcover, S-curves Publishing, 2014; ISBN 978-0976339601. Not the 2015 revised edition some ClimbOS docs cite. | EPUB | 9e11222d6d99a112 | OceanofPDF marks | Good. Figures are images. |

**Licensing:** the owner chose to proceed with paraphrase only on watermarked copies. Guides and notes are original synthesis. The copy check found no 12-word run shared with any book apart from titles (see [VALIDATION.md](VALIDATION.md)).

**Duplicates:**
- No duplicate files among the nine.
- The Kohavi EPUB in `docs/reference-books-2/` is byte-identical to `docs/reference-books/Trustworthy_Online_Controlled_Experiments_-_Ron_Kohavi.epub`, already used for BK06.
- *Sales Pitch* and *Obviously Awesome* (BK03) are different books by the same author. BK14 versions the BK03 guidance rather than repeating it.
- *How Brands Grow* Parts 1 and 2 are separate books, with overlap noted in the BK11 guide.

## Coverage

Each book's per-section coverage record is in [source_registry.json](source_registry.json) (`books[].coverage`). Every substantive chapter of every book was read.

| ID | Read | Skimmed | Skipped (non-substantive) | Unreadable |
|---|---|---|---|---|
| BK07 | 13 | 1 (acknowledgments) | 2 (bibliography; author page and back cover) | 1 (all figures and the appendix result equation are absent) |
| BK08 | 18 | 1 (advance praise) | 1 (external workbook, not in file) | 9 figures are images (recorded in notes) |
| BK09a | 10 | 0 | 0 (Ch 7–13 assigned to BK09b) | Slides, screenshots and vendor graphs |
| BK09b | 6 | 2 (Ch 11 hiring, Ch 12 onboarding, as briefed) | 1 (acknowledgments) | Churn chart, cadence calendar, example tables |
| BK10 | 15 | 3 (endorsements, bios, bibliography) | 0 | Chart images: values used only where the text states them |
| BK11 | 13 | 1 (references) | 0 | PDF pp. 3, 4 and 252 have no OCR text (blank or advert); tables are garbled |
| BK12 | 36 | 3 (front matter, appendix, author pages) | 1 (index) | 24 blank pages; most figures (captions only) |
| BK13 | 35 | 0 | 0 | 127 images plus the cover |
| BK14 | 24 | 0 | 2 (front matter, part dividers) | Figures 1–3 |
| BK15 | 26 | 1 (afterword) | 0 | Figures (Bullseye diagram and others) |

Unprocessed or uncertain items are listed in each guide's last section. The main ones:
- BK13's O/CO template and funnel-planner columns.
- BK10's Table 10.2 arithmetic error.
- BK12's internal contradictions: magic number, churn thresholds, the $6.06 example.
- BK09b's onboarding and short-contract arithmetic.

## How to use

- The engine reads none of this at runtime yet. Applying it means:
  1. Approve and apply the skill diffs, then run `pnpm skills:build` and a bench comparison under a cost cap.
  2. Move chosen playbooks into `shared/playbooks/contracts.ts` as typed contracts.
  3. Implement [BACKLOG.md](BACKLOG.md) items with tests.
- Rebuild: `python3 tools/build.py` (from this folder; reads the private reading records).
- Validate: `python3 docs/growth-expansion/book-research/tools/validate.py` (from the repo root).
