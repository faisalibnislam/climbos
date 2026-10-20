# Decision-code changes from the decision books

Branch `decision-engine-books`, cut from `growth-engine-v2` at `1321d8e`. Edition 2026-10-20. [GAP_MAP.md](GAP_MAP.md) is the map before changes; [MATRIX.md](MATRIX.md) maps each idea to its status.

**Labels used throughout.** *Source:* the author's idea. *Adaptation:* our engineering choice. *Assumption:* a value we chose. *Verified:* a unit test passes on this branch. No paid model runs were made, so nothing here is verified on real plans or real outcomes.

## 1. Evidence-aware diagnosis (`shared/agents/diagnosis.ts`, new `shared/analysis/bayes.ts`, new `shared/agents/references.ts`)

| | |
|---|---|
| **Before** | Weak/ok verdicts came from a point rate below a reference (`diagnose:105`). The lower raw rate between activation and purchase won (`:134`). A missing first-value count defaulted to "conversion" (`:135`). One SaaS trial reference applied to every signup model. Counts were never checked for consistency. |
| **Source** | Downey Ch 4 (small samples are distributions). Kochenderfer §4.2 (Beta posterior, eqs 4.25–4.28) and Ch 6 (value of information). Hernán & Robins Ch 1 and 7 (observation ≠ cause). Kohavi Ch 3 (Twyman's law: check the data first). |
| **Algorithm (adaptation)** | **Counts:** read as Beta posteriors with a labelled uniform prior worth 2 observations. **Link verdicts:** "weak" only if P(rate < reference low) ≥ 0.9; "ok" only if P(rate ≥ low) ≥ 0.9; otherwise "unknown". **Activation vs purchase:** compared by P(activation rate < purchase rate) (Simpson integration). At ≥ 0.8 one link is "supported"; otherwise the result is "ambiguous" with both hypotheses kept. **Consistency first:** visitors ≥ leads ≥ activated and paid ≤ leads; any contradiction returns `conflicting_inputs` with "Resolve:" tasks. **Maturity:** a period shorter than the sales cycle (from the `salesCycle` dimension) marks purchase readings immature. **SaaS reference:** picked by `signupKind` (free plan 2%, trial without card 15%, trial with card 40%); unknown means no reference. **Output per hypothesis:** observation, support/against and a discriminating measurement. **Leverage:** customers a month per +1 point at each link. |
| **Assumptions** | 0.9 and 0.8 thresholds (references.ts `DECISION_THRESHOLDS`, class strategic_preference). Uniform prior. Reference lows are grade-C practitioner figures; citations corrected (book-research R19). |
| **Inputs / outputs** | Adds `OwnerFunnel.signupKind` and `DiagnosisContext.salesCycleDays`. Adds `Diagnosis.status`, `hypotheses`, `conflicts`, `leverage` and `rules`, plus `StageReading.likely`, `probBelowReference`, `immature` and `referenceId`. `constraint` keeps its meaning and is "unknown" whenever the status isn't `supported`. |
| **Callers** | `convex/jobs.ts:976`: diagnose with sales-cycle days; the result is saved as `constraintDiagnosis`. `diagnosisBrief` feeds the plays prompt. `lintDiagnosisFit` now fires only on a supported diagnosis. `confidence.ts` gives ambiguous candidates "some" problem evidence. Funnel form `SharpenPlan.tsx` and mutation `workspace.setFunnel`: new "A signup is…" choice, stored in `businesses.funnel.signupKind`. |
| **Edge cases** | Zero counts, impossible counts (excluded and flagged), setup-only activation (basis stays partial), non-SaaS (no conversion reference). |
| **Cost** | About 2,000 Beta CDF evaluations per comparison; under 5 ms per plan. |
| **Compatibility** | Saved diagnoses stay readable: the new fields are optional and absent on old plans. The UI only reads `constraint` and `basis`. |

## 2. Hard vs soft eligibility (`shared/playbooks/contracts.ts`)

| | |
|---|---|
| **Before** | Every requirement blocked: a $300 budget for search, 700 visitors a week for split tests, a $25 price, 20 customers. "Avoid if there's a leak" was prose only. |
| **Source** | The owner's prompt §2. Kohavi Ch 17 (power depends on the baseline). Kochenderfer Ch 6 (decide on consequences). |
| **Algorithm** | Each requirement has a class. **Hard (blocks):** connection, consent (`audience_min`), business type, geography, owner hours, no ad budget at all, and a split test that can't finish in 6 weeks. **Preference (eligible, lower priority, reason shown):** budget and price floors, customer base, and `no_leak` (a supported activation, retention or conversion constraint lowers paid search, referrals and social; the brief then says "capped test only: no expansion"). **Computed checks:** search readability uses budget ÷ CPC (unknown CPC → "check first"). Split readability uses `sampleSize` on the owner's lead rate (the 700 fallback only when the rate is unknown). Status is `eligible`, `needs_evidence`, `low_priority` or `blocked`. |
| **Callers** | `jobs.ts:playbookContext` passes `constraintStatus`, `leadRate` and current customers (goal baseline when the goal counts total customers). Saved plan `playbooks.eligible[]` gains `soft` and `status`. |
| **Compatibility** | `PlaybookChoice` gains optional fields; `lintEligibility` behaves the same for blocked playbooks. |

## 3. Portfolio maths and feasible selection (`shared/growth/calc.ts`, `shared/agents/economics.ts`, `shared/agents/specs.ts`)

| | |
|---|---|
| **Before** | `portfolioCustomers` discounted every play, including the largest (adding a zero-customer play cut 12 to 9.6). `portfolioRange` summed per-play P10s and P90s (perfect correlation). Plays on the same funnel step added up. `playMaths` counted every customer passing through a play, including people who would have converted anyway. `lintFeasibility` only said "cut or drop a play". |
| **Source** | Kochenderfer Ch 14 (validate by enumeration and robustness), App. A.13 (sums of uncertain quantities need joint draws), App. C/E (exact search for small sets). Hernán & Robins Ch 1 (an effect compares with/without) and Ch 5 (interaction). |
| **Algorithm** | **Overlap:** largest + (1 − overlap) × rest. **Same-step plays** (activation, conversion, retention, offer) count as the largest of the group. **Range:** independent seeded draws per play, paired by seeded shuffles; the P50 stays the most-likely total (the locked-number basis). **`PlayStep.baselineRate`:** when given, only extra customers count, reach × (Π rate − Π baseline); `lintEconomics` warns when a same-step play omits it. **Robustness** (robust / fragile / loses / unknown) and **break-even customers** per play, shown in the locked numbers. **`selectPortfolio`:** enumerates up to 1,023 subsets under budget, owner hours and delivery capacity. It excludes plays that lose money at most-likely rates (moonshots excepted), ranks by contribution minus cost (or by customers when value is unknown), and names what's left out and the strongest alternative. It is budget-monotone. |
| **Callers** | `jobs.ts` saves `portfolio` in the plan (`strategies.expert.portfolio`, new optional field). Locked numbers print a "PORTFOLIO CHECK" line when not every play fits. The plays agent's `lintFeasibility` message names the computed best set. `lintDeliveryCapacity` and `ownerQuestions` now use 365.25/12 days a month, consistent with forecasts. |
| **Compatibility** | Saved plays keep their saved P10/P50/P90. Re-computed totals for multi-play plans rise (e.g. two equal plays: 1.6× → 1.8× one play), and same-step pairs fall. This is a deliberate number change and needs a bench comparison before release. |

## 4. Validation and the A/B engine (`shared/analysis/decisions.ts`, `shared/abtest/index.ts`, `convex/abtests.ts`, `shared/agents/specs.ts`)

| | |
|---|---|
| **Before** | `compareRates` accepted more conversions than visitors (reported p = 0). `decide()` ran after every view, send, lead and reply, and applied B at the first 95% reading, with no split check. The feasibility lint sized a visitor population with a per-lead rate. |
| **Source** | Kohavi Ch 2 (fixed horizon; confidence interval against a practical bar; six cases), Ch 17 (denominator = unit counted), Ch 21 (sample-ratio mismatch first). Kochenderfer Ch 15 (explore-then-commit). |
| **Algorithm** | **Counts:** validated. **Interval:** Newcombe hybrid-score 95% interval for the difference; optional `practicalChange` gives worth_acting / harmful / flat / small_but_real / inconclusive. **A/B:** no decision before the planned end (landing pages 1,000 views in total, email subjects 600 sends); then a 50/50 split check; then the exact or z test. A mismatched split keeps the original. **Feasibility lint:** converts the baseline to the population's unit (visitor → paid = lead × activation × purchase). The per-lead rate is kept as an upper bound when a link is missing. |
| **Callers** | Climb AI `calculate` tool (`practicalChange` input); `recordAb` (every event); plan experiment lint. |
| **Compatibility** | Running landing tests now end at 1,000 views (was up to 3,000) and never early. `confidence` is 0 until the end. |

## 5. Outcome learning (`shared/growth/actuals.ts`, `diagnostics.ts`, `experimentOutcome.ts`, `shared/agents/confidence.ts`, `convex/playResults.ts`)

| | |
|---|---|
| **Before** | Weeks before the plan counted as results. Logging gaps were ignored. "Behind" meant below P10 by now. A step "failed" at under half of plan with ≥ 30 trials. "Tracking broken" fired at ≥ 30 reached and 0 recorded, whatever the plan expected. Any holdout was "incremental". Owner-sourced rates made fix evidence "strong". |
| **Source** | Hernán & Robins Ch 22 (time zero), Ch 8 and 19 (missing follow-up), Ch 2–3 (exchangeability). Downey Ch 7 (predictive checks). Kochenderfer §4.2. Kohavi Ch 11. |
| **Algorithm** | **Time zero:** `playActuals(…, {startWeek})`; `actualsFor` uses the plan's creation week, and `log` rejects earlier weeks. **Gaps:** `weeksSinceStart`; no "ahead" while weeks are missing. **Behind** needs P(X ≤ count \| expected) ≤ 5% (Poisson) and a leading step that agrees. **A step is clearly short** when under half of plan and P(rate < plan) ≥ 0.95. **Tracking** is suspected only when the plan expected ≥ 3 at the first step. **Holdouts:** `assignment` (random / rule / owner_choice); only random counts as incremental. Others read "COMPARED, NOT RANDOMIZED". **Outcome lines** carry an interval for extra conversions. **Fix evidence** is "strong" only with `comparativeEvidence`; owner rates give "some". |
| **Callers** | Play cards (`PlayResults.tsx` via `forStrategy`). The next plan's `resultsBrief`. The outcome form `ExperimentOutcome.tsx`: new "Comparison group chosen" select; "Exposed" is relabelled "Assigned to the change". Schema `experiments.analyses[].assignment` (optional). |
| **Compatibility** | Stored analyses keep their saved inference. New holdout outcomes default to "At random" in the form, so the owner must change it if the group was hand-picked. |

## 6. What would change the decision: value of information (Hubbard, 3rd edition)

| | |
|---|---|
| **Before** | `decisionQuestions` swept revenue, margin, churn and owner hour across ranges the code made up (×0.5–×1.5, ×0.6–×1.25, ×0.5–×2). It counted flips without their stakes, ignored funnel rates, and showed no threshold. "Bankable" rested on the model's 1–5 predictability score. A set with negative expected contribution could still be selected. Ranges were never checked against outcomes. |
| **Source** | Hubbard Ch 3 (measure what could change a decision), Ch 5 (calibrated ranges; calibration is measurable), Ch 6 (Monte Carlo risk; ordinal scores aren't measurements), Ch 7 (thresholds, expected opportunity loss, EVPI), Ch 9 (measure to the threshold), Ch 14 (AIE: screen every variable; include "do nothing"). |
| **Algorithm** | New `shared/agents/voi.ts`. **`switchPoints(play, economics)`:** for reach, every step rate, revenue, margin, churn and owner-hour value, the break-even by bisection on the play's net contribution (point arithmetic, no simulation), with direction and margin from today's value. **EVPI** per input: expected loss of today's go/no-go call over a triangular range (401-point grid), computed only when the range carries an owner, research or benchmark source. **`stopRule(n, switch)`:** stop when successes ≤ k, the largest k with (k+1)/(n+2) below the switch rate; null when n is too small to show failure. **`playMaths`:** gains `lossChance` (share of seeded draws not paying back) and a `pointOnly` mode for searches. **`decidesLine`:** one locked line per play ("Decides it: pays back only if reply rate is at least 3.2%…; knowing it first is worth up to $X if its stated range is right; computed stop rule…"). **`decisionQuestions`:** keeps its flip screen but each question carries `switchValue` and direction, and the form says "Matters if it's below X". **Owner ranges:** typing "3–6" stores a range for revenue, margin or churn (`unitEconomics.ranges`; the midpoint is the value; a later single number replaces it), so EVPI uses the owner's own range. **Bankable** needs computed robustness (pays back at P10) when economics are known; the score gates only otherwise. **`selectPortfolio`:** returns "doing nothing new" when every set's expected contribution is below its cost. **`forecastCalibration`:** plays that ran their full horizon, fully logged, are checked against their P10–P90 (an 80% range) with an exact binomial tail; the next plan's brief says if past ranges were too narrow. |
| **Callers** | Locked numbers (plays prompt and plan). Plan card `PlayEconomics` (ExpertPlan.tsx) shows the deciding input and the loss chance. `workspace.ts` passes `decisionQuestions` to "Sharpen this plan", which accepts ranges, through `setUnitEconomics` (validated: low < high, same bounds, value required). `resultsBrief` adds the calibration line. Plays lint gates bankable. |
| **Assumptions** | Triangular reading of low/most-likely/high, the shape the forecasts already simulate; Hubbard reads them as 90% ranges with tails, which would raise EVPI. Calibration target 80%, because P10–P90 is an 80% band. Expected-value ranking is risk-neutral; the loss chance is shown beside it. |
| **Cost** | About 7 inputs × (60 bisection + 401 grid) point evaluations per play; a 4-play locked-numbers call stays well under the 1.5 s test bound. |
| **Compatibility** | New optional fields only (`unitEconomics.ranges`, `OwnerQuestion.switchValue` and `switchDirection`, `PlayMaths.lossChance`). Old plans recompute these at read time. |

**Before → after (hypothetical):**
- A knife-edge play (most-likely pays back; range skewed low) used to be selected. Now: "doing nothing new beats every set; run only capped tests that measure the deciding input first".
- A bankable play that pays back only at its most-likely rates used to pass on a model score of 4. Now it gets a lint error asking to firm the deciding input or call it creative.
- A churn question used to read "Decides whether a play pays back". Now it adds "A play pays back only if it's at most 51.2%", and the form says "Matters if it's above 51.2 %/month".
- "10 of 10 matured plays" used to give no calibration. Now 5 of 10 inside gives "overconfident (P = 0.033): widen this plan's ranges".

## Follow-up from the ADM exercise sets

Kochenderfer et al. Ex 4.1, 6.5–6.7, 14.5, 19.3, 20.2, 21.1 and 27.2.

- **"Behind" averages the Poisson tail over the plan's own P10/P50/P90.** The plan's rate is uncertain too. Example: 1 customer when 2–10 were expected gives P = 0.14 averaged, against 0.017 at the midpoint alone, so it isn't flagged. A clearly short leading step still decides on its own.
- **`selectPortfolio` ranks on expected customers** (the mean of joint draws, stride 4) and expected contribution, not the most-likely point. Skewed ranges no longer lose to steadier but smaller plays. The saved `expectedCustomers` sits next to the most-likely `customers` shown in the plan.
- **The strongest alternative must beat the choice** on customers, cash or hours. A set worse on every count isn't offered as a trade-off.
- **Two links within 10% of each other aren't ranked**, however large the counts (`DECISION_THRESHOLDS.materialGap`, version 2). Example: 30.0% vs 29.5% over 100,000 leads is ambiguous, not "conversion".
- **Not changed, recorded as limitations:**
  - Plays sharing a funnel step (e.g. the owner's close rate) are drawn independently, so the portfolio range may be too narrow.
  - Leads still inside the sales cycle count as non-buyers in play results (censoring).
  - An A/B test could stop once B can't win; low value.

## Before → after (actual outputs of the old code at 1321d8e vs this branch; all inputs hypothetical, b2b_saas)

| Case (assumptions) | Before | After |
|---|---|---|
| 4 trials, 0 paid (trial, no card) | conversion | unknown, insufficient_evidence (P below 15% = 0.56) |
| 10 → 3 → 1 | activation, measured | unknown, **ambiguous**: activation 0.59 / conversion 0.41 |
| 100 → 12 → 3 (the prompt's funnel) | activation, measured | activation **supported** (P 0.92) as an observation; conversion kept as the alternative; +1 point gives 0.25 vs 0.12 customers a month |
| 1,000 trials → 20 paid, first-value count missing | conversion | ambiguous: measure first value first |
| 50 leads, 80 "activated" | conversion, measured | conflicting_inputs: "Resolve: 80 reached first value but only 50 leads" |
| Free plan, 400 → 12 paid (3%), 600 visitors/month | conversion (judged on the 15% trial floor) | demand (3% is normal for a free plan) |
| Portfolio [12, 2] and [12, 0] | 11.2 and 9.6 | 13.6 and 12 |
| A/B 3/150 vs 18/150 | B applied at "99.9%" | collecting to 1,000; no early winner |
| compareRates 12 conversions of 10 visitors | difference_detected | rejected as impossible counts |
| Search pilot: $150/month, $1.50 CPC | blocked ($300 rule) | eligible (100 clicks a month) |
| Holdout chosen by hand | incremental | observed ("compared, not randomized") |
| 0 of 30 at a planned 2% | "tracking broken" | too few to judge |
| 0 of 25 at a planned 20% | too few | conversion step clearly short (P 0.997) |

## Verification performed

- `vitest run`: 131 files, 986 tests passing. That includes `tests/unit/decision-books.test.ts` (28 acceptance, before/after and follow-up cases), `tests/unit/decision-voi.test.ts` (11 cases; EVPI checked against an independent 200,000-step integration; binomial tail 0.0328) and `tests/convex/owner-ranges.test.ts` and updated expectations in 9 existing test files, where a test encoded the corrected behaviour.
- `tsc` (app and Convex): clean, apart from pre-existing generated `.next` types.
- ESLint on the changed files: 0 errors (2 pre-existing warnings in `jobs.ts`).
- The Beta and Poisson helpers were checked against closed forms (P = 0.5563, 0.5934, 0.2381).
- A seeded simulation shows identical A/B variants pick B in under 6% of 200 runs.
- **Costs:** $0. No model calls, no paid bench runs, no deployment. The browser UI wasn't checked, because the shared dev backend runs another branch.

## Acceptance cases (owner prompt §7)

| # | Status |
|---|---|
| 1 Wording invariance | Covered for diagnosis, eligibility and per-play maths. **Limit:** same-step grouping uses play wording (`playStage`), so renaming a play to another stage's words can change the combined total. |
| 2, 3, 4, 5, 6, 7, 8, 9, 10, 12 | Tested (`decision-books.test.ts`). |
| 11 Saturated play loses priority | **Not implemented.** Channel scoring doesn't read logged results (book-research backlog CG-21). |

## What a test would show as unhelpful (falsifiers)

- If owners' later results show "ambiguous" diagnoses resolving the same way as the old lowest-rate rule in nearly every case, the extra measurement step is wasted friction.
- If plans built after the overlap change overshoot logged customers more than before, the overlap or same-step rule is wrong.
- If fixed-horizon A/B tests rarely reach 1,000 views, landing tests need a computed horizon or an earlier metric instead.

## Remaining (deferred, with reason)

| Item | Reason |
|---|---|
| Records vs estimate flag on owner inputs (Hubbard Ch 5) | Needs a UI choice; ranges cover most of the need. |
| Pilot value (EVSI) and spend at 2–10% of EVPI | Needs a sampling model per step; the stop rule covers the decision. |
| Owner risk tolerance (investment boundary) | Needs elicitation UI; loss chance shown meanwhile. |
| Weighted channel scores: show when weights alone decide the pick (Hubbard Ch 12) | Scoring test planned; weights stay owner judgement. |
| Correlated draws for plays sharing a step | Needs plays to declare shared steps. |
| Censoring of immature weeks in play results | Needs a per-play lag. |
| Reported k-of-n plays | Needs a "no result" state per play. |
| Pre-registered predictions and calibration scoring | Needs schema and UI for predictions before results. |
| Guardrails at outcome time | Needs schema and UI. |
| Unequal-split and ratio-metric (delta method) variance | No caller passes split share or ratio metrics yet. |
| Saturation and logged results in channel scoring | Book-research backlog CG-21. |
| Pooled-tenant priors | No production consumer of `updated` rates. |
| Per-test randomization salt | The A/B split uses one hash across tests. |

**Next useful measurement:** run the 32-case expansion bench and the 213 book-research cases under an owner-approved cap, old versus this branch. Count unsupported causal claims, feasibility violations and plan totals. Then collect two months of owners' logged results to check forecast coverage (share of outcomes inside P10–P90) and interval width.
