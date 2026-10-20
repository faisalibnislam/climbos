# Decision-code gap map (before changes)

Branch `decision-engine-books`, cut from `growth-engine-v2` at `1321d8e` (plus the book-research docs commit `798f934`). Every path below was traced from its runtime call sites. Line numbers are at that commit.

## Dependency map (input → decision → persisted → shown)

```
businesses.funnel / unitEconomics (owner form, SharpenPlan.tsx)
  └─ convex/jobs.ts:971 diagnose()  ──► Diagnosis ─► plan JSON `constraintDiagnosis` (strategies.expert, v.any)
        ├─ jobs.ts:975 diagnosisBrief() ─► plays agent prompt
        ├─ jobs.ts:972 choosePlaybooks(playbookContext) ─► eligible/ineligible ─► plan JSON `playbooks`; playbookBrief ─► prompt
        └─ lockedConstraints(): funnelRatesOf ─► specs.lintExperimentFeasibility; diagnosis ─► lintDiagnosisFit
  scoring.ts scoreChannels() (jobs.ts:969) ─► scorecard ─► prompt
plays agent output ─► withForecasts()/playMaths() (economics.ts) ─► p10/p50/p90 saved per play
  ├─ lintEconomics, lintFeasibility, lintDeliveryCapacity (specs.ts:1170) ─► revise rounds
  ├─ portfolioRange/portfolioCustomers ─► lockedNumbers ─► plan agent prompt; goalGap ─► plan JSON
  └─ UI ExpertPlan.tsx: Forecast → playConfidence() (confidence.ts) per play card
playResults.log (owner weekly counts) ─► playActuals()/leadingBehind() (actuals.ts)
  ├─ PlayResults.tsx status + diagnoseShortfall() (diagnostics.ts)
  └─ resultsBrief() (playResults.ts:152) ─► next plan's prompt (first-party "facts")
recordExperimentOutcome ─► inferenceOf/readingOf/outcomeLine (experimentOutcome.ts) ─► experiments.analyses ─► resultsBrief
abTests: recordAb() on every view/send/lead/reply ─► decide() (shared/abtest) ─► auto-applies B (landing headline / email subject)
calculate tool (Climb AI) ─► decisions.ts compareRates/sampleRatio/sampleSize/beforeAfter
```

## Gaps by responsibility

| Responsibility | Current behaviour (file:symbol) | Failure case | Plan |
|---|---|---|---|
| Inputs and metric definitions | `diagnosis.ts:OwnerFunnel` has no checks that counts nest (activated ≤ leads ≤ visitors, customers ≤ leads), no sales-cycle maturity, and one SaaS reference for all signup models (`REF.trialToPaid`, line 114). | Leads 50 and activated 80 still produce a "measured" diagnosis. A freemium 3% rate is judged against the 15% trial floor. | Integrity check that returns `conflicting_inputs` with a resolution task. Maturity flag from the sales cycle. Reference chosen by `signupKind`; unknown means no reference. |
| Diagnosis | `diagnose:105` gives a weak/ok verdict from a point rate. `:134` picks the lower raw rate. `:135` names "conversion" when activation is missing. A single constraint is returned. | 0 of 4 leads paid reads "weak, measured". 10/3/1 reads "activation, measured", though P(purchase lower) is 0.59. | Beta-posterior verdicts. Competing hypotheses with probabilities, observations, support/against and a discriminating measurement. Status `supported`, `ambiguous`, `insufficient_evidence` or `conflicting_inputs`. Customers gained per +1 point at each link. Observation kept separate from cause. |
| Playbook eligibility | `contracts.ts:eligibility` treats every requirement as a block: $300 budget, 700 visitors a week, $25 price, 20 customers. "Avoid if leak" is prose only. | A $200/month high-intent search pilot is blocked by the budget rule. A suspected activation leak can't run a small diagnostic acquisition test. | Requirement classes: `hard` (block), `preference` (rank lower, keep), `needs_evidence`. The search pilot's readability is computed from budget, price and margin, with no fixed floor. The leak becomes a preference: capped test only, no expand step. |
| Economics and forecasting | `calc.ts:portfolioCustomers` discounts the first play too. `portfolioRange:272` sums per-play P10s and P90s. Plays on the same funnel step add up. `playMaths` counts every customer passing through. | [12, 2] gives 11.2, less than 12 alone. Two activation plays sum to 22 customers. The range assumes perfect correlation. | Largest + (1 − overlap) × rest. Plays on the same non-demand step combine as the max, not the sum. Range from a joint seeded simulation. Optional `baselineRate` per step so only extra customers count. Robustness class and break-even switch rate. |
| Portfolio selection | `specs.ts:lintFeasibility` only reports an over-budget plan and asks the model to cut. | Nothing says which feasible set is best or what was rejected. | `selectPortfolio()` enumerates subsets (≤ 8 plays) under cash, hours and delivery limits, excluding money-losers. It is budget-monotone and names the strongest rejected alternative. Used in the lint message, saved in the plan and shown in locked numbers. |
| Validation and approval invariants | `compareRates` accepts conversions > visitors (p = 0). The A/B engine reads after every event and auto-applies B. There is no split check in the A/B path. | Identical variants pick B in 13–33% of runs. | Input validation. Fixed horizon: one decision at the planned end, sample-ratio check, exact test. Confidence-interval reading against a practical boundary. |
| Outcome learning | `actuals.ts:playActuals` accepts weeks before the plan, ignores logging gaps, and has noise-blind "behind" and `leadingBehind`. `diagnostics.ts:49` flags a step at < 50% of plan with 30 trials. `experimentOutcome.inferenceOf` counts any holdout as incremental. `confidence.ts` treats owner-sourced rates as strong evidence that the fix works. | 0/30 at a planned 2% is called failing, though it is the most likely result. An owner-picked holdout is reported as "incremental". | Time zero (no weeks before the plan). Gap-aware status. Poisson-predictive "behind". Posterior step check. `assignment` field: only a random holdout is incremental. Fix evidence needs a comparison. |
| Knowledge governance | Reference ranges are inline in `diagnosis.ts:REF`, with no version, review date, class or counterexamples. | A base-rate miscitation went unnoticed (book-research R19). | `shared/agents/references.ts`: versioned reference registry with source, review date, applicability, class and missing-data behaviour. Diagnosis reads it. |

Already adequate, so left alone: `sampleRatio` (matches Kohavi Ch 21's example), `sampleSize` (within 0.5% of the 16σ²/δ² rule), the 7-day minimum and harm-stop rule, and `beforeAfter`'s observational label.
