# retention-lifecycle: proposed revision

Status: proposal. Not applied. Apply after owner approval and a bench run.
Growth: 1,788 → 2,177 words (+21.8%). Diff: `retention-lifecycle.diff`.

## Changes

| Change | Refs | Rule class | Why |
|---|---|---|---|
| Step 2: growth stages (continued value, value growth); outcome events, not logins, for background products; one-off sales keep purchase + review/referral | BK08-K4, BK08-K5 | strategic_preference | Step 2 stopped at activation. Recurring models need post-activation milestones. |
| Step 3: steady-state ceiling and replacement need, computed in code only; keep acquisition ≥ replacement unless capacity binds | BK10-K2 | contextual_heuristic | Adds the concept. Arithmetic stays out of prose. Calculator not yet in `decisions.ts` (code gap), so the skill says to list inputs only. |
| Step 3: size-driven and circumstantial churn; split churn by reason first | BK10-K2, BK11-F7 | missing_prerequisite | Stops "weak product" verdicts on normal small-brand churn. |
| Step 3: ecommerce low-repurchase caution; app churn at day 1/week 1/month 1; paid vs free churn | BK12-F16, BK12-F20, BK12-F22 | contextual_heuristic | Hillstrom modes kept as dated context, not thresholds. |
| Step 6: loyalty/VIP schemes state their job; penetration default for consumer/repeat; recorded exceptions for niche B2B, capacity-limited, early-stage; buyer moderation | BK10-K7, BK10-K3, BK11-K1 | strategic_preference (default) / contextual_heuristic (exceptions) | Implements the owner's conditional Sharp/Romaniuk decision. |
| Step 6: expansion and follow-on value; no exit friction; no upsell with open delivery issues | BK08-K4, BK07-K5, BK09b-K7 | external_requirement (no exit traps) / strategic_preference | Seller-side switching costs with the ethics line. |
| Step 10: loyalty evaluation by holdout or same-customer pre/post; reject member vs non-member | BK10-K7 | missing_prerequisite | Member comparisons are self-selected. |
| Never do: "5× cheaper" / "5% doubles profit" claims; VIP sized from one snapshot | BK10-K2, BK11-K1 | strategic_preference | Folk statistics presented as fact. |
| Checklist line for loyalty plays | BK10-K7 | — | Enforces the above. |

## Rejected or deferred

| Proposal | Reason |
|---|---|
| BK09b-K7 full high-touch B2B/agency branch (kickoff rediscovery, renewal ~6 weeks out, success reviews) | Duplicates `reference/lifecycle-by-business-type.md` (agency row already has kick-off, check-ins, renewal ahead of term). Only the upsell-suppression rule was added. Onboarding-cost share needs a calculator (code gap). |
| BK11-K1 "about half" heavy-buyer instability as a number to report | Kept as a caution only. Any Pareto or stability figure must come from owner data via a calculator. |
| BK12-F16 acquisition/hybrid/loyalty cut-offs (40%/60%) | Dated single-consultant benchmark; never a ClimbOS threshold. |
| BK07-K5 "rank follow-on offers above acquisition plays" | Ranking belongs to the planner and scoring, not this skill. |
