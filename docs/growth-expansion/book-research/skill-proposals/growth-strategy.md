# growth-strategy: proposed revision

Diff: `growth-strategy.diff` · size 11,864 → 14,849 bytes (+25%) · status: proposal, not applied.

## Changes

| # | Change | Source refs | Rule class | Why |
|---|---|---|---|---|
| 1 | Step 8 Bullseye: a proven channel → focus on it. Nothing proven → up to 3 capped parallel tests, each with a read date and three questions (cost, volume, fit). Primary only after the readout. 1 primary + 1 secondary after. | BK15-K1 | strategic_preference + contextual_heuristic | Old step 8 committed before testing, and step 10 tested the "middle ring", so the two steps contradicted each other. |
| 2 | Secondary is often conversion or trust work, not a second acquisition channel (context) | BK15-K1, Book 05 §9 | contextual_heuristic | Squares the 1+1 rule with "one channel dominates" |
| 3 | Tests and hygiene count toward the existing cap of 3 active channels; one affordable test → run tests in sequence | BK15-K1 | economic_feasibility | Keeps rubric G3's cap of 3 and the budget fit |
| 4 | Phases: launch inner-ring tests; day-45 readout; all tests fail → change message/offer first | BK15-K1 | contextual_heuristic | Same as #1 |
| 5 | "Name the advantage": benefit, barrier, competitor, evidence; execution and unknown are valid answers; no barrier → short-payback, reversible commitments | BK07-K1, K6 | strategic_preference | Tests whether the advantage lasts and ties spend to it. Doesn't call a small business strategy-less. |
| 6 | Compounding asset: say whether it builds a barrier or can be copied | BK07-K1 | strategic_preference | Same as #5 |
| 7 | Never do: claim a moat without a barrier and evidence | BK07-K1 | strategic_preference (truth rule) | Matches gate G1 |
| 8 | Retention leak: fix controllable churn first; capped tests and replacement-level acquisition continue. Context: normal, uncontrollable churn doesn't bind, so get churn reasons first. | BK10-K2, BK15-K4 | contextual_heuristic | The old "fix before acquiring" applied in every case. Sharp and Verna reconciled by how much churn is controllable. |
| 9 | Never cite "5× cheaper" or "5% doubles profit" as fact | BK10-K2 | strategic_preference | Folk numbers |
| 10 | Scoreboard: source tag per target (model / owner / external + year; external figures orient only, never pass/fail), hit and miss actions, one guardrail, switch rule | BK12-K2 | strategic_preference + contextual_heuristic | Targets had no provenance and no switch rule |
| 11 | Repeat-purchase B2C: buyers × purchases per buyer in code; show a penetration-led version. Context: a heuristic outside consumer repeat categories. | BK10-K1, K8 | contextual_heuristic | Owner's Sharp decision: a default only for consumer repeat categories |
| 12 | "North Star by stage" v2: stage read from evidence (Lean Analytics gates); while stickiness is unproven, paid acquisition runs only as capped tests; charging and first-purchase fixes are never gated; for one-off purchases, delivered value stands in for churn; capacity comes first; the owner can override | BK12-K3, F9 | strategic_preference (context: focus order) | Book's core contribution. The skill never defined "stage". |
| 13 | Vanity rule exceptions: ad-funded media; no cumulative counts | BK12-K1 | contextual_heuristic | Gap in the vanity rule |
| 14 | Diagnosis: journey walk-through produces hypotheses; counts locate the gap | BK08-K6 | contextual_heuristic | Generates repair ideas without claiming a cause |
| 15 | No demand capture: check presence, relevance and prominence first | BK11-K6 | contextual_heuristic | Make sure buyers can find and buy before adding demand |
| 16 | Step 6: context: no sales hire or SDR before the owner wins deals personally at a stable rate | BK09a-K1, BK09b-K8 | strategic_preference (as context) | Stops advice to scale too early |
| 17 | Description, Quality bar and checklist synced with 1, 5, 12 | — | — | Consistency |

## Rejected or deferred

| Proposal | Decision |
|---|---|
| BK07-K2 Power map (≤3 Power types, 5 Cornered Resource tests) | Rejected for this skill: too heavy for owner plans; #5 covers the decision |
| BK07-K3 Power Progression stage | Duplicate: step 4 already extends value only with the business's own repeat data |
| BK07-K6 advantage field + lint; BK12-K3 override log; BK10-K8 computed applicability status | Code (decision.ts, diagnosis.ts), not skill text |
| BK10-K1 ">20% frequency growth" trigger | Number not adopted (author-derived threshold); kept qualitative; deterministic check is a code gap |
| BK11-K7 two-stage launch, 3-month presence, 10-point cannibalisation rule | Category-first launch line moved to positioning. The 3-month span is ClimbOS policy and needs an owner decision. |
| BK15-K4 50% time rule | Rejected: founder-stage author advice; plans use the owner's stated hours |
| BK08-K7 Job tags, research staleness | Code / voc-research |
| BK07-K7 price-match break-even | Moved to growth-plays (counter-positioning) |

## Companion changes needed before applying

- `skills/growth-strategy/rubric.json` G3 and the focus criterion's anchor 5 still say "1 primary, 1 secondary". Allow "≤3 capped tests, primary after readout", or the judge will penalise #1.
- `shared/acquisition/scoring.ts select()` and the specs focus lint label primary/secondary up front. They need a `test` status (BK15-K1 code gap).
- Bench: the skill hash changes; run the 32-case harness before applying.
