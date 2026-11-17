# Translation source constraints — 17 November 2026

## Existing path and reproduced gaps

The audit followed `translate.start` → scheduled `translate.run` → `translate.source` → model output → `translate.save` → `insertArtifact` → normal content approval. This contributes to requirement 44 and the owner's cross-channel offer consistency, source evidence and approval requirements.

Existing translation already created a separate private draft, retained the channel, copied some offer metadata and used existing credits/model routing. Four controlled regressions exposed material gaps: structured trend evidence was discarded; a queued worker could read a newer source version/title/destination; save trusted caller-supplied offer terms; and the internal source query did not bind its artifact to the run's tenant/request. The initial real-timer edit case raced the scheduled worker, so tests were changed to control scheduler timing; all four regressions then failed before the repair. This timing control was also applied to the existing repurposing source tests.

## Implemented behavior

- Translation launch saves exact source version and title with the language in the existing workflow input. The source resolver checks run kind, request identity, supported language, tenant and artifact/version relationship. Queued edits do not silently change the selected text, title, destination or retained assets.
- The writer sees original offer constraints, selected play and historical copy brief through the existing untrusted-data wrapper. It is instructed to preserve terms without refreshing evidence or granting action authority.
- Save re-resolves the pinned source and independently applies the existing offer validator to the fields actually saved. Optional old worker offer arguments remain accepted for compatibility but cannot supply authority or override stored terms. Source/language substitution and blank output are rejected. A repeated successful save returns the existing run artifact rather than creating another copy.
- A small shared `convex/lib/artifactSource.ts` helper now serves translation and repurposing. It retains source copy-brief context and original trend observation/retrieval dates, filters referenced fact IDs by the current tenant/business, preserves unknown stage values, and labels the inherited brief for adaptation/evidence review. This is reuse of existing artifact/schema logic, not a new agent or provider.
- A translation remains in review. It does not inherit the source's approval or schedule. Stale trend evidence still blocks approval, and original offer snapshots remain available to subsequent content edits/review. Missing/deleted or legacy-unpinned sources fail with an owner-readable message instead of selecting the latest content or leaving a falsely verified result.
- Engine revision: `v3.128-translation-source-context`. No schema or generated-file changes.

## Verification and boundaries

Focused tests exercise actual scheduled actions with mocked model output, controlled source edits, preserved evidence dates/fact IDs, stale-trend approval rejection, wrong-price rejection, caller-supplied term substitution, tenant isolation, language mismatch, missing/legacy source failure, result replay and separate approval/schedule state. Existing repurposing, publishing and permission regressions remain in the suite. Exact commands/results are in Verification.

No paid model, live provider, browser interaction, publishing or deployment was performed. Native-language quality, preservation of meaning and all localized urgency/eligibility wording are not proven. The reused offer validator recognizes a bounded set of price/currency and language patterns; it is not a universal multilingual checker. The saved destination is pinned, but this change does not independently verify every translated inline URL, placeholder or sentence. Preserved assets are not newly translated images. Old completed translations are unchanged; queued jobs without a saved version need a new request. Source evidence remains historical, not newly verified fact. The full 410 requirements plus later specifications remain incomplete.
