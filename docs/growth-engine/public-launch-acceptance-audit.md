# Owner-selected public launch acceptance — 17 November 2026

## Purpose and input boundary

This acceptance case uses the owner's selected website, Livoform. The earlier November 9 case and all historical results remain unchanged. `bench/strategy-quality/livoformLaunch.ts` combines a new, dated public-source pack with a strictly validated, locally supplied owner-report file. Private reports and prepared inputs stay in the existing ignored `bench/cache/` directory and are not committed.

Public pages read: [homepage](https://livoform.com/) and [pricing](https://livoform.com/pricing), inspected 17 November 2026. Publication/update dates were unavailable; the pricing search reader reported an older cached crawl. Page statements remain source-reported, not tested product behavior or demand. The pack distinguishes monthly versus annual billing and company versus seat prices. Homepage demonstration analytics are not evidence of business results. Three linked pages could not be retrieved; they are disclosed as uninspected and excluded from allowed source citations.

Owner statements remain owner-reported. They do not create measured funnel rates, a reporting interval, audience permission or a verified geographic market. The initial 14-day window and zero paid-media allocation are evaluation constraints, not claims about the business's actual deadline or budget. Costs and operating capacity remain unknown. No live database, customer account or business action is touched.

## Existing path reused

The dedicated `launch-acceptance` stage calls the existing focused strategy spec and `runAgent`, with its current model route, budget ledger, per-request reservation, output validation and result identity. It accepts only Livoform, the focused route and the dated pack; conflicting extra evidence or cheap-draft overrides are refused. Supplying owner context to a different stage fails rather than silently ignoring it. No provider, agent or production workflow was added.

The owner report file schema permits a fixed website, valid report date and bounded statements. It cannot supply a model, route, publishing permission or budget override. API transmission still requires the owner's applicable approval; a local prepared packet is not an executed test or quality pass.

## Verification

**22 tests in six files passed (0.475 seconds)**:

```sh
pnpm exec vitest run tests/unit/livoform-launch-input.test.ts tests/unit/industry-evaluation-input.test.ts tests/unit/evaluation-identity.test.ts tests/unit/anthropic-budget.test.ts tests/unit/ai-qa-budget.test.ts tests/unit/evaluation-budget.test.ts
```

Cases cover owner versus source provenance, absence of invented numeric funnel/audience/location inputs, pricing-unit caveats, failed source reads, explicit evaluation clock, withheld review questions, malformed date/website/empty reports, and existing cache/budget safeguards. A real local export produced three owner-report entries, two inspected source citations and six review questions with zero model calls. Private files are confirmed Git-ignored. Application/Convex typechecks, changed-file ESLint and diff checks passed. These were preparation checks; the subsequent approved execution is recorded below.

## Approved execution and acceptance result

After explicit owner approval to transmit the public pack and supplied reports to Anthropic, four metered calls completed: draft, review, one revision, and final review. Engine: `v3.153-plural-offer-mechanisms`. Selected-source fingerprint: `de74d2ab65baa52aacd7ba0f3d42604dbdbeb483604506dbd52d30cc879837f4`. Variant: `launch-owner-20261117`; focused 14-day route. Actual model: `claude-sonnet-5-5`. No model route or acceptance threshold was changed.

| Check | Observed result |
|---|---|
| Structured output | Passed schema validation |
| Initial assessment | Average 3.63; gates failed; two lint errors |
| Revised assessment | Average 3.75; minimum 3; gates passed; zero lint findings |
| Required quality acceptance | **Failed** (`ship: false`) |
| Weakest scored dimensions | Economics/uncertainty and owner decision clarity: 3 each |
| Provider calls | Four completed; no retry or additional comparison call |
| Test cost | $0.626074 |
| Cumulative charged or held | $59.818528 across both ledgers, within the approved $100 cap |

These are the engine's writer/reviewer results, using the same model family. They are not independent human judgments or evidence of customer acquisition. The original failed output, phase records and receipts remain unchanged and Git-ignored. A separate local owner report reviews all six held-out questions without another paid call; it does not replace the original assessment.

## Gaps exposed by inspecting the actual output

The output prepares a specific proposed customer job, distinct strategy alternatives, draft assets and an activation measure. It distinguishes proposed work from executed activity and avoids adding a promotion. However, it is **not accepted as an owner-ready strategy**:

- **Evidence honesty:** a narrative field converts unknown audience availability into an assertion of absence. Other fields call a proposed route the quickest or cheapest without comparative evidence. The deterministic lint and automated truth gate missed these semantic claims. Zero lint findings therefore do not establish factual support.
- **Decision quality:** the selected segment is a plausible hypothesis, but insufficiently compared with other concrete customer jobs. The paid-conversion reasoning and cost/support boundary remain weak.
- **Owner effort:** the first week combines the main test with a side integration check. Exploration alternatives leak into immediate execution work and dilute the first action.
- **Measurement:** the two observation windows can contain different exposure levels; no clear fallback is supplied for a first window with no activity. A small activation count cannot establish commercial viability or a causal lift.
- **Originality:** the options use different mechanisms, but the bold option is a familiar advisor-led distribution pattern. Its self-assigned high novelty is not independently established. A structurally complete portfolio is not proof of surprising strategic quality.

These findings remain open. No production prompt patch, weaker rubric, case-specific exception or silent rewriting of the model output was used to turn this run into a pass. Future engine changes should be evaluated on counterfactual sparse-data cases and fresh paid output if authorized, rather than adding word bans that only fit this one response.

## Post-run focused and permission checks

```sh
pnpm exec vitest run tests/unit/livoform-launch-input.test.ts tests/unit/industry-evaluation-input.test.ts tests/unit/evaluation-identity.test.ts tests/unit/anthropic-budget.test.ts tests/unit/ai-qa-budget.test.ts tests/unit/evaluation-budget.test.ts tests/convex/plan-approval.test.ts tests/convex/safety.test.ts
```

**46 tests passed in eight files (5.81 seconds).** These cover input/provenance/cache/budget handling and the existing plan approval/safety boundaries using local fixtures. They do not prove semantic strategy quality or constitute an end-to-end production test of this generated record. No campaign was sent, published, scheduled or funded; no product or customer account was changed.

## Limits

This is a bounded shared-engine acceptance case, not a full browser/Convex production journey, verified product functionality or business outcome. Publication and community/platform recommendations need their own current checks and exact approvals. Public website claims and owner reports cannot establish causal demand or commercial viability.
