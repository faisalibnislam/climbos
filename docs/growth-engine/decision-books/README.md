# Decision books → decision code

Edition 2026-10-20, branch `decision-engine-books`. The owner's task: read five books in full, then improve the deterministic code that calculates, scores, diagnoses, constrains and validates decisions. Books are in `docs/reference-books-2/` (gitignored, never committed).

| File | What |
|---|---|
| [GAP_MAP.md](GAP_MAP.md) | Dependency map from input to persisted decision to UI, and the gaps before changes |
| [SYNTHESIS.md](SYNTHESIS.md) | Original cross-book synthesis: claims, limits, conflicts, out of scope |
| [MATRIX.md](MATRIX.md) | Book-to-code matrix: 99 ideas with locators and status |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Code changes, callers, persisted outputs, before → after, verification, remaining work |

## Reading status

| # | Title (as supplied) | Edition (from the file) | Format | SHA-256 prefix | Coverage | Gaps |
|---|---|---|---|---|---|---|
| 1 | *Think Bayes*, Allen B. Downey | **First edition**, O'Reilly 2013 (ISBN 9781449370787, OPF); not Think Bayes 2 | EPUB | 2d520c6ed037e521 | **Complete:** 22 of 22 units read | 157 of 165 equation images and 42 of 49 figures not viewed. None carries a formula an adopted idea depends on; 15 that matter were viewed. |
| 2 | *Algorithms for Decision Making*, Kochenderfer, Wheeler, Wray | First edition, MIT Press 2022 (ISBN 9780262047012), CC BY-NC-ND. Author web build stamped 2026-09-20 | PDF, 700 pp | d63d4132230e7b4c | **Complete:** all 27 chapters, 26 exercise sets with solutions, Appendices A–G; references and index reviewed as such | 29 pages with no text were rendered: all blank. Every adopted formula was checked against the rendered page. Six small book errata noted privately. |
| 3 | *Causal Inference: What If*, Hernán & Robins | Online edition dated 2026-08-19 (© 2020, 2026; Chapman & Hall/CRC 2020); no ISBN in file | PDF, 365 pp | a1067af923e9156b | **Complete:** 66 of 66 units read (Ch 1–23); references and index reviewed as such | Some causal diagrams read from text only; no adopted idea depends on them. |
| 4 | *How to Measure Anything* | **Not the requested book.** The file is Christopher Joseph (general editor), *How to Measure Anything: The Science of Measurement*, Ivy Press 2022, a units-of-measurement reference. Douglas Hubbard's book wasn't supplied. | EPUB | 9581b712b71d58f2 | **Not read:** owner is supplying Hubbard's copy | Value-of-information logic waits for it. Switch-point checks from Kochenderfer Ch 6 stand in. |
| 5 | *Trustworthy Online Controlled Experiments*, Kohavi, Tang, Xu | First edition, Cambridge University Press 2020 (ISBN 9781108724265 / 9781108653985) | EPUB | 045028227f6572a7 | **Complete:** 230 of 230 spine units read; references and index reviewed as such | Byte-identical to the copy used for BK06. OceanofPDF marks present. A few illustrative screenshots not inspected. |

**ADM note.** Four readers read the chapters and appendix text. The end-of-chapter exercise sets (skimmed at first) and the remaining Appendix D/F figures were then read in full by two follow-up readers. Their findings changed four rules (see IMPLEMENTATION.md § Follow-up).

The full per-unit coverage ledger is kept privately with the reading notes, outside git: `reading-coverage.md` in the session scratch folder.

**Claims.** Four of five books are read in full. The fifth (Hubbard) was not supplied, so the five-book requirement isn't met yet. Reading these books doesn't make the engine expert. The changes are judged by the tests and the measurements in IMPLEMENTATION.md.
