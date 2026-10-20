# experiment-design: proposed revision

Status: proposal. Not applied. Growth: 1,530 → 1,727 words (+12.9%). Diff: `experiment-design.diff`.

## Changes

| Change | Refs | Rule class | Why |
|---|---|---|---|
| Classic A/B: 6 weeks noted as planning default; calculator hard-flags over 12 | BK13-K4; `shared/analysis/decisions.ts:171` | unknown_to_investigate | Skill (6) and code (12) disagree. Flagged, not resolved. Owner horizon should decide. |
| Pooled multi-page test with per-page direction check | BK13-K4 | contextual_heuristic | Low-traffic option. |
| User tests as the comprehension measure; bought traffic only from an approved budget | BK13-K4 | contextual_heuristic; missing_prerequisite (budget) | No budget is assumed. |
| Channel discovery test: tracking first; inconclusive ≠ failed; one bounded optimisation round inside an owner-set band | BK15-K2 | missing_prerequisite; strategic_preference | Discovery tests are not splits. No default band adopted. |
| Run time in whole weeks, at least one | BK06; `decisions.ts:170` | strategic_preference | Owner reconciliation: whole-week duration stays; now explicit in the skill. |
| Confidence rule: causal wording needs randomised, pre-registered, fixed-end read, split check, 5% two-sided. Lower threshold only pre-registered, cheap, reversible, labelled directional | BK06, EXP-C2, BK13-K4 | strategic_preference | Owner reconciliation: ExP rule stays; BK13's 85–90% allowed only as a directional business threshold. |
| Never do and checklist lines | BK13-K4 | — | Enforces the above. |

## Rejected

| Proposal | Reason |
|---|---|
| BK13 "end at 85–90% confidence" as a general rule | Conflicts with EXP-C2/BK06. Allowed only in the narrow directional form above. |
| BK13 promote a research-driven challenger at a fixed end even if not winning | Same conflict; allowed only as a pre-registered directional rule for reversible changes. |
| BK14-K5 pitch pilot test type | Belongs to sales-follow-up/positioning; not in this skill's scope. |
