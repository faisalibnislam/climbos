# Acquisition Intelligence (layers 1–3)

Built from the owner's framework (`docs/research/acquisition-framework.md`).

| Piece | Where |
|---|---|
| Library: 30 business types, 20 families, 210 channels (stable IDs S/P/O/C/D/R/M/N/E/V/X), budget bands | `shared/acquisition/library.ts` |
| Dimensions, eligibility, factor priors, adjustments, budget-disciplined selection | `shared/acquisition/scoring.ts` |
| Scoring agent (classify + evidence-backed factor deltas, one pass, no review) | `channelFitSpec` in `shared/agents/specs.ts` |
| Runs first in the plan job; scorecard steers plays and plan | `buildStrategy` in `convex/jobs.ts` |
| Saved: profile + adjustments on the plan, classification on the business | `strategies.acquisition`, `businesses.acquisition` |
| Owner view and confirmations (re-rank instantly, no AI) | `convex/acquisition.ts`, Plan → Channels tab |

## Scoring
1. **Eligibility:** channel requirements (location, products, app, software, nonprofit…) vs the business's traits. Ineligible = "Not a fit" with the reason.
2. **Priors (0–100) per factor:** audience (type starters 85, listed 70, else 40; business-model rules), intent (best stage), budget (min spend vs budget), time, feasibility (who executes, team size), competition (50 until evidence), scalability, measurement.
3. **Adjustments:** the agent may move any factor by −30…+30 only with evidence.
4. **Weighted score:** 20/20/15/10/10/10/10/5.
5. **Selection:** budget band caps channels and paid channels (e.g. $600 → 3 channels, 1 paid); ≥ 60 not selected → "Later".

## Not yet (layers 4–5)
Per-channel CAC/LTV/payback tracking and the weekly optimisation agent need tracked links and revenue attribution first.
