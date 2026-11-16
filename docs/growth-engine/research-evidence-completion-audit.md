# Research evidence acceptance: completion audit

17 November 2026. Scoped continuation of the 410-requirement audit: rows 21–25, especially whether unsupported research can become saved business context. The retained numbered inventory supplies scope; the original Downloads prompt is unavailable. Growth-intelligence Book 14 sections 4–5 provide reference principles, not implementation evidence.

## Current path

`onboardingResearch` loads tenant-scoped context, reads bounded website pages (or owner text), extracts a profile, saves sourced profile claims, and runs the existing business-insights writer/reviewer. Its input includes confirmed facts, supplied page URLs and page text plus bounded independent research. The output includes audience hypotheses, commercial evidence, competitors, quoted website observations, SWOT support and proposed tests. `saveInsights` stores the result, checks customer-language excerpts against actual research page reads, and retains audience excerpt checks. Later strategy jobs read this saved context. Owner work history exposes the job status and failure message.

## Reconciliation

| Row | Confirmed implementation | Remaining limitation |
|---|---|---|
| 21: duplicate facts | `factDuplicates.ts` groups normalized same-category/state wording for display while retaining records; lexical near matches are review suggestions with amount, currency, polarity and recognized entity guards. | General semantic deduplication and arbitrary entity/relationship equivalence are not proven. This batch did not change grouping. |
| 22: contradictory information | `conflicts.ts` identifies bounded pricing, trial and feature contradictions; job briefs retain current/stale disagreements. Existing plan controls use the conflict results. | Arbitrary semantic contradictions, temporal resolution and source authority are not comprehensively resolved. |
| 23: outdated information | `factFreshness.ts` uses explicit category review intervals; invalid/future dates require review. `jobWrites.jobContext` separates stale facts. Owner reconfirmation and business-model context freshness already exist. | An age threshold is not proof of incorrectness or live source monitoring. No historical research migration is included. |
| 24: source reliability | Structured source classes, source URL membership, fact references, quoted-page checks, commercial-evidence limits and excerpt statuses exist. The new final acceptance gate enforces existing schema/lint checks on retained v2 insights. | A matched quote or valid reference does not establish semantic support, representative demand, independent truth or universal correctness of evidence labels. |
| 25: insufficient information | Research allows empty evidence, explicit unknowns and uncited labeled inferences with a small proposed test. Unsupported final results now fail without replacing saved insights. | Model judgment about which unknown matters, all unstructured claims and expert decision quality remain unproven. |

These broad rows remain partial. Rows 26–30 and the rest of the original and later scope are not closed by this audit.

## Confirmed gap repaired

The shared writer can retain its best draft after revision exhaustion. Onboarding saved that retained result and marked the run verified without re-running evidence/schema checks at the acceptance boundary. Six job-boundary regressions reproduced verified results for an unread citation, missing research for a cited external page, invented website quote, website demand claim, nonexistent fact reference, and missing required commercial structure. The mocked reviewer explicitly approved the output, showing that its verdict could not replace deterministic validation.

The real v2 path now reuses the exact original insights spec and input, with actual returned research metadata, to parse and lint the retained result before persistence. An error stops the job with an owner-readable research message, leaving earlier insights intact. Valid researched language and explicitly labeled speculative hypotheses remain accepted. Existing first-take work is awaited; its profile preview and the separately saved sourced profile are not rolled back or misrepresented as accepted deep research. Legacy/fixture paths remain unchanged. Engine version: `v3.118-insights-acceptance`.

## Evidence and boundaries

86 tests across 11 files passed, covering the changed job plus source validation, research persistence/cache, onboarding, failure history, tenancy and approval boundaries. The final 15-case research-context rerun additionally verified that owners can read the actual failure message and another tenant cannot. Root/Convex type checks and scoped lint passed. Commands are recorded in `docs/Verification.md`.

No UI changed, browser test or paid model evaluation ran, and no network/provider action was used by the new regression. Stored insights are asserted unchanged for rejection; valid page-read evidence still enters the phrase bank. This does not sanitize every historical insight, prove model reasoning, enforce semantic truth for every claim, or complete the full product specification. Continue with source-label fidelity and missing-input/forecast acceptance across the remaining paths.

## Source-class follow-up

Engine v3.119 adds recorded-provenance agreement to insights lint and therefore final acceptance: commercial evidence, SWOT and audience needs/objections/motivations/channel preferences must label every cited source consistently. Owner statements about analytics remain owner reports; researched fact records remain source-reported; absent metadata is not a measurement. Mixed source classes require separate findings or an explicitly inferred interpretation. Uncited inference and correctly sourced claims remain valid. This reuses the source-class resolver already used by offer/timing checks and the metadata already present in job constraints; it does not add another source store or infer classes from statement text.

Twelve unit failures demonstrated the gap. The final 105-test run also covers actual job input provenance, accepted owner labels, rejected owner-to-measured and source-to-owner labels, preserved saved insights, owner-visible failure messages and foreign-tenant denial. Typecheck and lint pass. Source-class agreement does not establish semantic support, independence, causal validity or factual truth; business-fact ingestion still does not supply a new measured-data connector. Historical and legacy/fixture results are unchanged. Rows 21–25 remain partial at their full scope.
