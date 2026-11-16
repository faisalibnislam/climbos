# Channel and audience evidence: plan acceptance audit

17 November 2026. Continued strategy-path audit, covering source identity for the channel and audience choices presented in default and detailed plans. Relevant references: growth-intelligence Book 05 sections 1–3 and Book 14 section 5. The library states intended behavior; runtime code and tests establish the bounded findings below.

## Existing behavior inspected

Focused plans retain one primary move, at most two channel recommendations and three prepared drafts. Their structured grounded/adjacent/bold portfolio remains separate from simultaneous campaign execution. Strategic direction includes the current bet, conditional next horizon, deliberate sacrifices, assumptions and change-course conditions. Existing prepared-work validators check supplied references and public copy; this batch did not change those contracts.

`jobs.buildStrategy` supplies context to focused/starter or detailed strategy. `runtime.lintAgentOutput` provides recorded source URLs and research metadata to the spec. `lintCites` checks channel/audience references; quality treats citation errors as hard failures. `jobWrites.saveStrategy` stores channel/audience source links through `resolveCites`. Owner approval and starting the focused move check saved quality. The inspected representation is not proof that the model selects the best channel or keeps every natural-language action aligned with its diagnosis.

## Confirmed gap and repair

`lintCites` previously searched the combined brief, facts, task and research text using a lowercased URL substring with query/fragment removed. A mentioned-but-unread page could count as researched evidence, a shorter URL could match part of a recorded address, and different query/path capitalization could be conflated. Conversely, a recorded URL absent from prose could fail.

The helper now receives the structured source list rather than prose. Both plan-spec call sites pass available research URLs plus precomputed research sources. Membership uses the existing URL normalizer: HTTP(S) only, normalized hostname and trailing slash, ignored fragment, preserved path case, host identity, scheme and query. Fact-index references retain their existing range checks. Empty citations remain possible for hypotheses, with the existing top-channel warning when evidence is available; this is not a requirement for every novel idea to have precedent.

`resolveCites` uses the same normalizer for deduplication and source-title lookup. A different host, path or query cannot borrow the title of a recorded page. Unmatched historical HTTP(S) references can still be displayed without a matched source title; this read helper does not retroactively certify or rewrite old plans.

## Verification and boundaries

Four new spec-level regressions failed before repair: all three plan styles accepted unsupported citations, and exact structured sources absent from prose were rejected. Tests now exercise differing path case, queries, prefixes, prompt-only URLs, valid facts, equivalent fragments/trailing slashes, and source-title isolation.

Actual focused/starter job cases use a cached source, mocked provider output, persisted quality and owner approval/start calls. Four invalid-reference cases fail quality and cannot be approved or started; two exact-source cases preserve links in saved channels and audiences. No action receipts or granted approvals are created by the invalid cases. See Verification for final commands/results.

No prompt, provider, schema, agent, calendar or UI change. Engine `v3.121-plan-source-membership`. No live provider, paid model or browser evaluation. Source membership does not prove that the cited page supports the claim, that buyers use the channel, or that an inferred strategy is sound. Source aliases/redirects require explicit recorded evidence rather than assumed equivalence. Other validators still have their own reference policies; this audit does not certify them all.

## Remaining strategy work

Continue auditing customer relevance and platform-specific eligibility in the default focused path, owner-dismissed channel feedback, semantic consistency among the primary move/channels/prepared work, and representative business-quality evaluation. The bounded two-channel schema limits presentation size; it does not prove portfolio quality. Retention, geographic fit, complete buying-experience evaluation and market-change reasoning retain the limits already recorded in the requirement inventory. Requirements 31–40 and the full product scope remain open where acceptance evidence is missing.
