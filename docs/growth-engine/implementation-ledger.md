# Growth engine implementation ledger

Source: `ClimbOS_Growth_Engine_Claude_Code_Prompt V2.md`, with requirement IDs as written there. Baseline: `404c466`. Branch: `growth-engine-v2`.

## Status key

| Status | Meaning |
|---|---|
| **done-fixture** | Implemented, proven by deterministic tests only. Not live and not measured with a real model. |
| **exists** | Was already in the code before V2. Checked against HEAD. |
| **partial** | Some of it exists. The gap is named. |
| **missing** | Not built. |
| **blocked** | Needs an external setup or approval (named). |

Nothing on this branch is deployed. Production is `main` at `c5dfc09`.

## Resumption note (2026-10-19, after S5 remainder and S6)

**Done:**
- S0, S1, S2/S3 (deterministic), S4 (core), S5 (capability context, decision contract, structured decision, hard limits before ranking) and S6 (plan targets) on `growth-engine-v2`. Not deployed.
- New behaviour is behind two per-workspace flags: `decision_contract` (S5) and `plan_targets` (S6). No workspace is opted in.
- 727 tests pass. `tsc` is clean (app and convex). ESLint shows 0 errors (15 older warnings).
- Everything here is fixture-tested only. No real model run, no live search, no browser check against a live backend.

## Resumption note (2026-10-24, engine and learning work)

Since the original S4 note, owner economics now recalculate forecasts, portfolio selection and goal gap on plan reads; approval and play launch are blocked if the inputs differ from the plan snapshot. Outreach learning now separates any replies from owner-reported reply disposition, and sparse first-party rates remain visible with a conservative planning bound. Generic all-business rate pools have been removed. These changes are pushed on `growth-engine-v2`; they are not deployed or live-model validated.

The attached improvement brief's Issue 21 now has canonical display grouping for same-category, same-review-state facts with equivalent normalized meaning; source records remain attached to the display row and reviewing the canonical fact updates the whole exact group. Matching is deliberately high precision (normalized terms, currency/value, entity words and negation), not embedding-based semantic deduplication. Issue 22's narrow price/trial/capability conflict detector now compares pending researched facts with confirmed/edited facts and returns each fact's review state and source evidence; it remains separate from duplicate grouping.

Issue 23 now separates facts past their category review interval from the current verified fact index used by agents. The previous statements remain available in a bounded, untrusted recheck block; they cannot be cited as confirmed through structured fact references. Age alone remains a review signal, not proof a statement is false.

Issue 24 now has shared research and critic instructions to assess source role, publication/measurement date, method, population, fit, and independent origins; planning prompts carry those limits into recommendations. The engine does not assign a numeric reputation score or independently validate a publisher's credibility, and this assessment remains model-reviewed rather than a deterministic source registry.

**Next:**
1. **S2 remainder.** Add an old-plan read adapter with schema versioning (REQ-ENG-03), stored from `expert.version`. REQ-EVID-02 now requires the quote to contain the supplied population and period, plus denominator for percentage rates; the model must supply those fields. This is lexical binding, not semantic proof that a source's cohort applies to the business. Files: `shared/agents/provenance.ts`, `convex/workspace.ts` (read path).
2. **S3 remainder.** Make the CAC and the headline use the same basis (REQ-MATH-06). Add a sensitivity line per play (REQ-MATH-07). Add a currency field to economics, no mixing (REQ-MATH-08). Model ramp and sales lag (REQ-MATH-04). Files: `shared/agents/economics.ts`, `ExpertPlan.tsx`.
3. **S4 remainder.**
   - Sparse first-party rates use a Wilson lower-bound planning value; check finer offer/audience/geography/stage match and calibrate when to use pooled rates (REQ-LEARN-05).
   - Audit repeated-release risk in pooled rates; current protections require 10 businesses, cap each contributor, and round released rates/counts (REQ-LEARN-06). This is not formal differential privacy.
   - Regenerate the saved plan narrative after owner edits and finish the stale-plan UX (REQ-LEARN-07, REQ-UX-07); deterministic projections already recalculate on read and work is gated.
   - Link retained-customer revenue/contribution to play outcomes (REQ-LEARN-02); explicit qualified/not-qualified/unclear reply dispositions now supplement any-reply.
4. **S5 gaps.** Fulfilment capacity, minimum evidence and financial viability aren't in the pre-ranking filter yet (REQ-STRAT-03). Strategy-level best-of-two still compares drafts, not options (REQ-STRAT-02). Contrasting-business evidence from real runs needs the paid check.
5. **S6 gaps.**
   - Only one target search runs at a time (the one-campaign pipeline). Approval auto-starts the first target-heavy play; the others start from the play card.
   - Partnerships, communities, podcasts and directories reuse the company/creator search; they have no dedicated schemas (REQ-TARGET-01 table).
   - Creator records lack content language, audience numbers with a source, and collaboration tracking (REQ-CREATOR-01/05/06). Today doesn't list targets yet (REQ-UX-08).
6. **S7** competitor discovery is next in program order.
7. **Opting in a workspace:** run `npx convex run engineFlags:setEngineFlag '{"orgId":"…","flag":"decision_contract","on":true}'` (and the same with `"plan_targets"`). This needs owner approval because it runs against the deployment.

**Paid check:** a proposal is ready in [evaluation-and-cost.md](evaluation-and-cost.md) §6 ($5 cap). The approved budget is still $0.

**Owner decisions pending:**
- release of this branch;
- funding for the §6 check;
- a staleness policy for owner confirmations;
- which workspaces to opt into the flags.

## Slices

| Slice | Status | Commits | Done-when met? |
|---|---|---|---|
| S0 Baseline and ledger | done | this file, master spec, research ledger, evaluation-and-cost §5–6, Capabilities/EngineV2/architecture banners | Yes. Each requirement below has a status and a surface |
| S1 Quality states | done-fixture | `d22a639` | Yes. A failing lint case is saved as `failed` and can't be approved (`tests/convex/plan-approval.test.ts`). A provisional plan stays inspectable |
| S2 Evidence lineage | partial, done-fixture | `13476ed` (pre-V2 F1–F4), `746e350` | Partly. The negative provenance fixtures fail safely and owner input survives. The legacy read adapter and schema version are still to do |
| S3 Calculations and goal | partial, done-fixture | `746e350`, `9b4c2ab`, `1bf428d` | Partly. The reference fixture passes, the goal stays intact and the gap is explained. Ramp/lag, currency and the CAC basis are still to do |
| S4 Measurement integrity | partial, done-fixture | S4 commit | Yes. A cumulative-views fixture isn't reported as a 120-day rate, and a play rename keeps its observations. Shrinkage, privacy audit and recalculation are still to do |
| S5 Decision-centred strategy | partial, done-fixture (flagged) | `1bf428d`, `3d44c75`, `3dd664c`, `171c252` | Mostly. Capability context is live per run. Under `decision_contract`: the decision contract, a structured decision (observations, competing explanations, options and why each lost, guiding policy, falsifier) and hard limits before ranking. Contrasting fixtures produce different channel agendas, and retention outranks acquisition on a long cycle (`channel-limits.test.ts`). Real-run evidence needs the paid check |
| S6 Targets in plan | done-fixture (flagged) | `0329044` | Yes, in fixtures. Under `plan_targets`, approving a plan starts the first creator or outbound play's search, linked by play ID. The play card shows named targets or a truthful state: researching, none found, needs your input, needs connection, waiting or failed (`plan-targets.test.ts`). No live search was run |
| S7 Competitor discovery | missing | — | — |
| S8 Content briefs | missing | — | — |
| S9 SEO inventory | missing | — | — |
| S10 CMS publishing | blocked + missing | — | Needs CMS credentials for a sandbox |
| S11 Reviews | blocked + missing | — | Needs Google Business Profile API access approval |
| S12 Automation registry | missing | — | — |
| S13 Knowledge freshness | missing | — | — |
| S14 Routing/cost evaluation | blocked | — | Needs a funded cap (§6 proposal) |
| S15 Polish and release | missing | — | — |

## Requirements

### Outcome, context and strategy

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-OUT-01 | partial | S5 | `shared/agents/specs.ts:59-100` (PlaySchema) | Has audience, hook, funnel, test and first action. No structured diagnosis→effect→evidence→target→capability chain |
| REQ-OUT-02 | partial | S5 | `specs.ts:189` | Generic-phrasing lint is a warning and regex only |
| REQ-OUT-03 | done-fixture (flagged) | S5 | `specs.ts` `lintPlays` (`decisionContract`), `planTasks.ts` `DECISION_CONTRACT`, `convex/engineFlags.ts` | With `decision_contract` on, 1 to 4 plays of any kind; a single retention play is valid (`decision-contract.test.ts`). Off by default; no workspace opted in |
| REQ-OUT-04 | partial | S3/S5 | `shared/agents/goal.ts`, `planTasks.ts` | The goal gap states short or out of reach in code (`goal-gap.test.ts`). The plan doesn't yet name the binding constraint in a structured way |
| REQ-OUT-05 | partial | S5 | `shared/agents/quality.ts` | Plan-level provisional/needs_input only. Actions aren't split into safe-now vs depends-on |
| REQ-CTX-01 | partial | S5 | `convex/jobs.ts` `planSnapshot` | Snapshot holds counts, goal and goal target. Not versioned, no contradictions or freshness, not reused by content jobs |
| REQ-STRAT-01 | done-fixture (flagged) | S5 | `shared/agents/decision.ts`, `specs.ts` `PlaysDecisionOutputSchema`, `jobWrites.ts` `expert.decision`, `ExpertPlan.tsx` `DecisionSummary` | Under `decision_contract`: observations with sources, a binding constraint (demand, activation, conversion, offer, positioning, retention, delivery or economics), at least 2 competing explanations with evidence for and against, what's unknown, and a falsifier with a number and a date. The plays agent fills it in the same call; code checks it. An incomplete decision makes the plan provisional (`decision-structured.test.ts`, `decision-save.test.ts`) |
| REQ-STRAT-02 | partial (flagged) | S5 | `decision.ts` `options` | 1 to 4 options, exactly one chosen, and each loser says why it lost; one option is allowed for a trivial choice. **Gap:** best-of-two still compares drafts, not options (`routes.ts:39`) |
| REQ-STRAT-03 | partial (flagged) | S5 | `shared/acquisition/scoring.ts` `limitChecks`, `select`; `convex/acquisition.ts` | Before ranking: cash (minimum spend vs budget, upfront cash with no budget), owner time (hours a channel needs vs hours given), sales cycle (time to learn plus the cycle vs the goal date; existing-customer channels exempt) and capability (missing connection = setup, never blocked). Blocked channels are never picked; late ones only fill slots no on-time channel can. Off by default, so the default scorecard is unchanged (`channel-limits.test.ts`). **Gap:** fulfilment capacity, minimum evidence and viability aren't checked here |
| REQ-STRAT-04 | partial | S5 | `specs.ts:544`, `DECISION_CONTRACT` | Flagged task asks for one primary motion, a supporting move and maintenance. No structured guiding policy yet |
| REQ-STRAT-05 | done-fixture (flagged) | S5 | as REQ-OUT-03 | The flag replaces the mandatory shape. The default path keeps it until evaluated (§6 proposal) |
| REQ-STRAT-06 | partial | S3 | `economics.ts` lint, `planTasks.ts` | The money-loser remedy no longer says "raise volume or conversion". The task says never raise reach or rates. Measured effect: not measured |
| REQ-STRAT-07 | missing | S5 | — | Qualification, fulfilment and refunds aren't modelled |
| REQ-STRAT-08 | partial | S5 | `specs.ts:743` | Channel-fit deltas need evidence. No owner override with a rationale |

### Evidence and provenance

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-EVID-01 | done-fixture | S2 | `provenance.ts` `verifyTag` (owner case), `economics.ts` `applyOwnerEconomics` | "Owner" only from structured `unitEconomics` with a fixed unit and period. Tests: `tests/unit/provenance.test.ts` (coincidence cases) |
| REQ-EVID-02 | partial | S2 | `provenance.ts` `checkResearch`, `specs.ts` `SourceTagSchema` | Exact canonical page from this run's search, verbatim quote, exact number and unit, metric word; supplied population and period must occur verbatim in the quote, and percentage steps also require their denominator. **Gap:** string matching cannot establish semantic fit or that the described cohort applies to this business; legacy/unlabelled evidence remains limited |
| REQ-EVID-03 | partial | S2 | `provenance.ts` (`access`, `check`) | Distinct states: read / search-only / unavailable / not-in-search, then retrieved / source_verified / owner_input. **Gap:** semantic compatibility and empirical calibration have no separate states |
| REQ-EVID-04 | partial | S1/S2 | `quality.ts`, `provenance.ts` | Unverified claims stay "reported" with a label. **Gap:** no automatic downgrade of a firm money decision that rests on a reported claim |
| REQ-EVID-05 | done-fixture | S2 | `specs.ts:57` SourceTagSchema; `provenance.ts` `read()` stamp check | The model can't write check, stamp, access or receipt (`provenance-s2.test.ts`). Forged stamps read as reported |
| REQ-EVID-06 | partial | S2 | `economics.ts` `applyOwnerEconomics` (`replaced`), `ExpertPlan.tsx` | Owner overrides keep the replaced value and source, and the UI shows them. **Gap:** calculation input IDs aren't persisted, and an owner edit doesn't invalidate approvals (only a "newer than plan" banner) |
| REQ-EVID-07 | done-fixture | S2 | `provenance.ts` (allocation becomes `planned`) | Budget/time caps aren't treated as rates. Test: owner-tagged spend becomes planned |
| REQ-EVID-08 | partial | S3 | `economics.ts` `churnOf`, `monthlyContribution` | Unknowns stay null (`economics-fixtures.test.ts`). **Gap:** assumptions don't carry sensitivity or a validation task |

### Mathematics and goals

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-MATH-01 | done-fixture | S3 | `shared/growth/calc.ts`, `shared/agents/economics.ts` | Both audited. The pure formulas were correct; wrapper coercions removed. The §8.3 reference reproduces exactly |
| REQ-MATH-02 | done-fixture | S3 | `churnOf`, `applyOwnerEconomics` | Zero churn is valid. Unknown churn stays null with no value or verdict. Owner zero churn is kept |
| REQ-MATH-03 | done-fixture | S3 | `economics.ts` `rateOf` | Ratios above 1 are rejected and listed in `invalidInputs`. Never read as percents |
| REQ-MATH-04 | partial | S3 | `playMaths`, `portfolioRange`, `planTasks.ts` | Fractional horizon (3 days = 3/7 week); spend by calendar month; totals at the goal horizon. **Gap:** ramp time, sales lag, seasonality and fulfilment capacity |
| REQ-MATH-05 | partial | S3 | `lockedNumbers` | The text says forecasts aren't calibrated and are scenarios. **Gap:** the UI doesn't separate operational and statistical uncertainty |
| REQ-MATH-06 | done-fixture | S3 | `economics.ts` `PlayMaths.headline`, `withForecasts`, `portfolioRange`, `lockedNumbers` | The headline and CAC share the most-likely basis. The simulation gives the range, widened to include the headline (`economics-fixtures.test.ts`). Prompted by the paid check, where the judge flagged the mismatch. **Gap:** no expected CAC under uncertainty |
| REQ-MATH-07 | partial | S3 | `playMaths.profitable` (nullable), lint | Never "profitable" on unknown economics. Break-even shown. **Gap:** no sensitivity or decision state per play |
| REQ-MATH-08 | partial | S3 | `portfolioRange` | Periods aren't mixed. **Gap:** economics assume USD with no currency field; attributed vs incremental revenue isn't separated |

### Targets, competitors, creators

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-TARGET-01 | done-fixture (flagged) | S6 | `outboundCampaigns.playId/strategyId`, `prospects.playIds`, `convex/targets.ts` | Reuses prospects and campaigns (no parallel tables). Each campaign links to a play's stable ID; each prospect lists the plays it serves. A shortlist of 10 is requested; fewer are kept when evidence is thin. **Gap:** partnerships, communities and podcasts use the company/creator schema |
| REQ-TARGET-02 | partial | S6 | `convex/ai/prospectCheck.ts` | Site and MX checks; fit is a model score |
| REQ-TARGET-03 | partial | S6 | `shared/growth/targets.ts` `creatorIdentity`, `outbound.ts` `saveResult` | Creators are keyed by platform and handle (or YouTube channel ID), never by a shared domain. URL variants match, and post URLs name no account. Older records with a profile-path key are still matched. Platform and handle are stored. Unflagged, because it is a dedupe fix (`targets.test.ts`). **Gap:** no refresh schedule |
| REQ-TARGET-04 | done-fixture (flagged) | S6 | `convex/targets.ts` `autoStartPlanTargets`, `workspace.ts` `decidePlan` | Approval starts the first target-heavy play's search within credits. It never archives an open search or pauses sending by itself; then the play waits for the owner. The rest start from the play card (`startForPlay`) |
| REQ-TARGET-05 | done-fixture (flagged) | S6 | `targets.ts` `targetReadiness`, `convex/targets.ts` `forStrategy` | The states are not started, waiting, researching, failed, none found, needs your input (no public contact route), needs connection (no mailbox) and ready. The plan itself isn't held back by a search |
| REQ-TARGET-06 | done-fixture (flagged) | S6 | `outbound.ts` `saveResult`, `targets.ts` | There is one record per entity across plans and campaigns. A re-found target is linked to the play and keeps its stage. Declined, lost, contacted and opted-out targets never count as contactable. Play IDs carry over, so a refreshed plan keeps its targets and starts no duplicate search |
| REQ-COMP-01 | missing | S7 | `competitors.ts:27` | Suggestions only; the owner adds each one |
| REQ-COMP-02 | partial | S7 | `specs.ts:40` | Kind enum. No exclusion rules |
| REQ-COMP-03 | missing | S7 | — | No verification |
| REQ-COMP-04 | partial | S7 | `competitors.ts:17` | Caps exist. No auto-seed, mute or exclude |
| REQ-COMP-05 | exists | S7 | `shared/competitors/index.ts`, `competitorActions.ts:63-87` | Diff first, then Luna. Tracking and nav noise aren't filtered |
| REQ-COMP-06 | partial | S7 | `competitors.ts:116` | Doesn't rewrite the strategy. Creates no proposed action |
| REQ-COMP-07 | missing | S7 | — | |
| REQ-CREATOR-01 | partial (flagged) | S6 | `targets.ts` `targetKindOf`, `creatorScoutSpec` | Creator plays now trigger the existing creator search, linked by play ID. Records keep platform and handle, and "contact route not found" is shown. **Gap:** content language, audience numbers with a source, and collaboration concept fields |
| REQ-CREATOR-02 | partial | S6 | `specs.ts:895` | Location and audience aren't separated |
| REQ-CREATOR-03 | missing | S6 | — | |
| REQ-CREATOR-04 | missing | S6 | — | (No fraud claims are made either) |
| REQ-CREATOR-05 | partial | S6 | outreach `firstLines` | No check against a real content example |
| REQ-CREATOR-06 | missing | S6 | `links` table only | |

### SEO, copy

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-SEO-01 | partial | S9 | `specs.ts:225` | Page type only |
| REQ-SEO-02 | missing | S9 | — | |
| REQ-SEO-03 | partial | S9 | `tasks.ts:143` | The draft is always written |
| REQ-SEO-04 | blocked + missing | S10 | — | No CMS adapter. Needs a WordPress sandbox |
| REQ-SEO-05 | partial | S9 | `shared/integrations/searchConsole.ts` | Adapter not called from `convex/` |
| REQ-COPY-01 | partial | S8 | `specs.ts:195-229` | Per-channel schemas. No unified brief |
| REQ-COPY-02 | partial | S8 | `jobs.ts` `planContext` | No angle-selection step |
| REQ-COPY-03 | partial | S8 | skills, `runtime.ts` | Prompt only |
| REQ-COPY-04 | partial | S8 | `specs.ts:840-851` | |
| REQ-COPY-05 | partial | S8 | `artifactVersions.claimFactIds` | |
| REQ-COPY-06 | partial | S8 | `lint.ts:10` | Banned list only |
| REQ-COPY-07 | partial | S8 | `specs.ts:692` | Exact duplicates only |
| REQ-COPY-08 | partial | S8 | `brand.ts`, `voiceSamples` | No consent, no applied-rule record |

### API, automation, reviews

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-API-01 | exists | — | `shared/ai/openai.ts`, `climb.ts` | |
| REQ-API-02 | missing | S5/S14 | `openai.ts:190` (`store:false`) | Reasoning items aren't carried across tool calls. Check against the official guide |
| REQ-API-03 | partial | S5 | `climb.ts:26`, `jobs.ts:95` | Search uses is a context size, not a hard count. `webFetch` is ignored by the OpenAI adapter |
| REQ-API-04 | partial | S5 | `strictSchema`, `climb.ts`, `climbTools.ts` `encodeToolOutput` | Tool inputs are Zod-validated before dispatch; tool results now require JSON-safe data, have boundary markers escaped and are bounded in size before returning to the model. **Gap:** per-tool semantic output schemas and URL validation for every tool result remain incomplete. |
| REQ-API-05 | partial | S5 | TurnResult, `uncertain` | No coverage limits |
| REQ-API-06 | partial | S5 | workflowSteps, actionReceipts | Evidence and calculations aren't linked to decisions |
| REQ-AUTO-01 | missing | S12 | `lib/autopilot.ts` | Autopilot-specific only |
| REQ-REV-01 | blocked + missing | S11 | `schema.ts:61-81` | No GBP provider. Needs Google API access approval |
| REQ-REV-02 | missing | S11 | — | |
| REQ-REV-03 | partial | S11 | `inbox.ts:181` | No templates or policy |
| REQ-REV-04 | partial | S11 | prompt | No sensitive-topic routing |
| REQ-REV-05 | missing | S11 | — | |
| REQ-REV-06 | partial | S11 | `reviews.ts:173` | Paste a review, then draft. No platform link or "mark done" |

### Knowledge, learning, cost, evaluation

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-KNOW-01 | partial | S13 | skills, learnedRates, engineProposals | No formal three layers |
| REQ-KNOW-02 | missing | S13 | — | |
| REQ-KNOW-03 | partial | S13 | `schema.ts:734` | No source or applicability |
| REQ-KNOW-04 | partial | S13 | `engineLab.ts:159-199` | No holdout |
| REQ-KNOW-05 | partial | S13 | `playCatalogsFor` | No retrieval or citations |
| REQ-LEARN-01 | done-fixture | S4 | `shared/growth/learnedMetrics.ts`, `convex/learning.ts` | Each metric states its window. Lifetime view counters are divided only by lifetime conversions; landing and bio are now "all time" (`learned-metrics.test.ts`) |
| REQ-LEARN-02 | partial | S4 | `learnedMetrics.ts`, `outbound.setReplyDisposition`, `learning.ts`, `playResults.ts` | Any reply remains distinct from owner-reported qualified/not-qualified/unclear disposition; added emails→qualified reply. Booked→attended uses `bookings.outcome`. Won CRM deal values now link to stable target play IDs as owner-reported association, not attribution. **Gap:** retained-customer revenue/contribution is not tracked. |
| REQ-LEARN-03 | done-fixture | S4 | `learnedMetrics.ts` `rateLine`, `playResults.ts` | Counts, window, 90% Wilson range and "observed, not proof of cause". No "grade A". **Gap:** attribution method and lag aren't shown |
| REQ-LEARN-04 | done-fixture | S4 | `convex/jobWrites.ts` `withPlayIds`, `convex/playResults.ts`, `playResults.playId` | Plays get stable IDs, carried to the next plan version by name. Results match by ID, so a rename keeps them (`play-results.test.ts`). Older rows match by name |
| REQ-LEARN-05 | partial | S4 | `learning.ts`, `learnedMetrics.ts` | Sparse owner rates are retained and exposed with a conservative 90% Wilson lower-bound planning rate; only same-business-type pools are shown, with an explicit context-transfer warning. **Gap:** offer, audience, geography and stage similarity are not yet stored or compared; no empirical calibration of the bound. |
| REQ-LEARN-06 | partial | S4 | `learning.ts`, `learnedMetrics.ts` | Same-type pools require 10 qualified workspaces; each workspace contributes at most 100 trials per metric, and agent-visible rates, counts and cohort sizes are rounded. Raw content and tenant IDs are not pooled. **Gap:** repeated-release differencing has not been formally evaluated and there is no differential-privacy guarantee. |
| REQ-LEARN-07 | partial | S4 | `workspace.ts` owner-economics snapshot, live forecast/portfolio recalculation, approval/start gates | Confirmed economics now recalculate forecasts, portfolio choice and goal gap on plan reads. Approval/play launch is blocked when owner economics differ from the plan snapshot. The plan narrative still needs regeneration to reflect the changed numbers. |
| REQ-COST-01 | partial | all | this ledger | Decision records are written per slice in commit messages. No formal record per workflow yet |
| REQ-COST-02 | partial | S14 | `ops.ts` owner decision records + verified strategy runs | The operator dashboard reports actual cost per owner-approved plan over 30 days. **Gap:** accepted outputs from non-plan workflows aren't linked to owner acceptance yet. |
| REQ-COST-03 | partial | S12/S14 | reservation, `jobs.ts:95`, `engine.ts:192` | No per-automation ceiling |
| REQ-COST-04 | partial | S14 | bench arms, `bench/run.ts --import-arm` | Two paid Basic runs on 2026-10-19 ($4.62 of a $5 cap): B1 lost 2–3, then 1–1–3, to B0. Causes: timid inputs from the softened wording, and a headline/CAC basis mismatch. Both fixed (ambition restored, headline on the most-likely basis). Another run needs new funding (cap $2.50) |
| REQ-COST-05 | missing | S14 | `routes.ts` | Mode-based only. Explicit Expert choice preserved |
| REQ-COST-06 | missing | S14 | — | |
| REQ-COST-07 | partial | S14 | cache blocks, `prompt_cache_key` | Hits not measured |
| REQ-COST-08 | missing | S14 | — | |
| REQ-COST-09 | partial | S14 | `wordCaps.ts` | Not tuned from measurements |
| REQ-COST-10 | exists | — | `jobs.ts:349-381` | |
| REQ-COST-11 | partial | S14 | `ops.ts:42` | No per-model report or anomaly alert |
| REQ-COST-12 | partial | S0 | `docs/Capabilities.md`, `docs/EngineV2.md`, `capacity.ts`, `rates.ts` | Stale routing and capability claims fixed 2026-10-19. Frozen rates exist. Provider setup docs not yet checked |
| REQ-EVAL-01 | partial | S0/S14 | `evaluation-and-cost.md` | Four kinds of evidence defined. Bench output doesn't report them separately |
| REQ-EVAL-02 | partial | S14 | `shared/abtest` | Engine Lab uses its own A/B |

### UX

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-UX-01 | partial | S15 | `ExpertPlan.tsx`, `PlanSections.tsx` | The North Star card now shows goal / plays support / gap |
| REQ-UX-02 | done-fixture (flagged) | S6 | `ExpertPlan.tsx` `PlayTargetsBlock`, outbound page `?campaign=` | Each play card shows up to 5 targets: name, profile link, fit reason, contact route or "contact route not found", and stage. It also shows a state badge and a link to the full list. Not checked in a browser |
| REQ-UX-03 | done-fixture | S6 | `workspace.ts` `startPlay`, `targets.startForPlay` | "Make it happen" sends the plan and play IDs, and the server builds the request from the stored play. Older plays without an ID use the old text path. "Find targets" also uses IDs |
| REQ-UX-04 | partial | S15 | actionCards status | |
| REQ-UX-05 | partial | S15 | `workspace.ts:460`, `lib/approvals.ts` | A failed-quality plan can't be approved (S1) |
| REQ-UX-06 | partial | S2 | `ExpertPlan.tsx` | Source, check and page-access labels plus replaced values. No source inspection drawer |
| REQ-UX-07 | missing | S4/S15 | — | |
| REQ-UX-08 | partial | S15 | `workspace.ts:22` | |
| REQ-UX-09 | partial | S7/S15 | `crons.ts:46`, `competitors.ts:118` | Competitors notify on every change |
| REQ-UX-10 | partial | S15 | `shared/a11y`, e2e | |

### Engineering

| ID | Status | Slice | Paths | Evidence / gap |
|---|---|---|---|---|
| REQ-ENG-01 | done-fixture | S5 | `organizations.engineFlags`, `convex/engineFlags.ts` (internal, audited), `planSnapshot.flags` | Flags are per workspace and set by staff; plans record which were on (`engine-flags.test.ts`). The flags are `decision_contract` and `plan_targets` |
| REQ-ENG-02 | done-fixture | S1 | `shared/agents/quality.ts`, `convex/jobs.ts`, `convex/schema.ts`, `convex/workspace.ts`, `PlanActions.tsx` | `plan-quality.test.ts` (8 cases), `plan-approval.test.ts` |
| REQ-ENG-03 | partial | S2 | `openai.ts` `normalizeNulls`, zod at output | Strict-schema nulls preserved (`openai-nulls.test.ts`). `expert.plays`/`economics` are still `v.any()`; no read adapter |
| REQ-ENG-04 | partial | S4 | `learning.ts:93` | Sequential loop over every org |
| REQ-ENG-05 | exists | — | actionReceipts, publish reconcile | Outbound sends have no receipt |
| REQ-ENG-06 | partial | — | `settings.ts:518-600` | No new tables in S1–S3. The goal target lives on the existing `goals` row |
| REQ-ENG-07 | exists | — | `untrusted()` wrappers; research only fetches URLs this run's search returned | |
| REQ-ENG-08 | partial | S2 | provenance receipts (fetch time + content hash), snapshot | Page text isn't stored. The hash proves what was read, not what it said |
| REQ-ENG-09 | partial | S13 | facts provenance | |
| REQ-ENG-10 | exists | — | `scripts/skills-build.mjs` | No skill edits in S1–S3 |
| REQ-ENG-11 | done-fixture | S5 | `capacity.ts` `capabilityContext`, `jobWrites.ts` job context | Built per run from connected providers and the approval mode; nothing unconnected is promised (`capability-context.test.ts`). Bench and Engine Lab use the static text |
| REQ-ENG-12 | partial | S0 | docs listed under REQ-COST-12 | Pricing and provider setup docs not yet checked |
