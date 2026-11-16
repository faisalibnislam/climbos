# Ad destination consistency from plan to draft

17 November 2026. Follow-up to the plan execution and channel-consistency requirements. This is a repository routing repair, not verification of live provider access, platform policies or advertising results.

## Confirmed path and gap

A detailed approved plan maps `search_ads` and `meta_ads` through `convex/lib/cards.ts` to `google_search_ad` and `meta_ad`. Those values already reached the reserved job and scheduled `jobs.createContent` action. However, ad generation ignored the selected destination: the task always requested Google and Meta, `adsSpec` required neither destination-specific output nor emptiness of the other array, and `adsToArtifacts` saved both arrays. The direct content generation API shared this path. Six regressions failed before the repair: four plan-to-artifact destination cases and two invalid-result cases.

The owner content dialog currently requests the generic ad bundle without a platform selection; that behavior remains unchanged. Existing content previews and campaign controls distinguish Google and Meta artifact channels. No Next.js code was changed.

## Implemented behavior

- The selected platform reaches the existing usage quote, research brief, writer/reviewer skills, task and structured output schema. A single-platform schema requires at least one draft for that destination and an empty array for the other destination.
- The existing lint pipeline reports platform mismatches during revision. A final deterministic check rejects mixed-platform or empty output for a selected-platform request before artifact saving, including legacy and demo paths that do not use the v2 schema. Unsupported explicit destinations fail without producing drafts.
- Older unstarted plan cards resolve their platform from the approved plan's canonical channel key before reservation. Their stale payload cannot override that choice. Parked, foreign or unapproved plans retain existing checks.
- Generic ad requests retain the existing two-platform draft bundle. This repair does not infer platform selection from arbitrary prose in a generic brief.
- Demo fixtures follow explicit destinations; the schema-sampling test double honors an empty-array constraint. Neither fixture is evidence of creative quality or campaign performance.
- Drafting creates private copy artifacts only. It does not create a provider campaign, publish, schedule, send or spend. Campaign authorization, account eligibility, exact artifact versions and budget checks remain separate.

Engine version: `v3.124-ad-destinations`. No new agent, provider, integration, table, generated file or owner-facing interface was introduced.

## Verification and remaining limits

Nine focused cases exercise actual plan-card and direct-content mutations through scheduled jobs and saved artifacts: Google and Meta in demo and v2 modes; mixed/empty output rejection; unsupported destination rejection; generic request compatibility; and stale-card resolution. Successful plan cases assert draft/in-review status and absence of campaigns/action receipts. Broader campaign, approval, tenant, lint and engine tests are recorded in Verification.

The initial expanded run had one malformed test fixture (missing required action-card description and priority); correcting that fixture required no production workaround. Typecheck then passed.

This establishes routing and validation, not platform-native persuasion, customer/audience fit, budget accuracy, provider API operation or profitability. Existing generic requests, historical artifacts and already-running jobs are not rewritten. Email audience/offer consistency and remaining plan-to-execution mappings still need focused acceptance auditing. The complete 410-row requirement set and later owner specifications remain open.
