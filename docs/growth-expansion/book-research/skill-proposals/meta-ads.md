# meta-ads: proposed revision

Status: proposal. Not applied. Growth: 2,049 → 2,222 words (+8.4%). Diff: `meta-ads.diff`.

## Changes

| Change | Refs | Rule class | Why |
|---|---|---|---|
| Broad default: narrow only for eligibility, capacity or a listable B2B target | BK11-K4 | contextual_heuristic | Makes the existing broad default's exceptions explicit. |
| Concept matrix: vary content, keep the same 1–2 declared brand cues | BK11-K3 | strategic_preference | Reconciles "visually different first frame" with consistent identity. |
| Frame 1: product/result/face carrying a brand cue; name early; no logo card or "Introducing…" | BK10-K5, BK11-K3 | contextual_heuristic | Branding is a hurdle (BK10-F25: ~16% of exposures noticed and correctly branded, one dated TV study). |
| End frame adds name or logo | BK11-K3 | contextual_heuristic | Branding early and late, not end-only. |
| Report unique reach and frequency; widen or rest when frequency rises and reach plateaus | BK11-K4 | contextual_heuristic | Reach-first reading. |
| context: steady monthly spend over bursts and month-scale judgement for consumer/repeat | BK10-K5, BK11-F28 | contextual_heuristic | Owner's conditional decision; demand capture keeps cost-per-result windows. |
| Quality bar: identifiable in opening and end; default vs context split | BK11-K3 | strategic_preference / contextual_heuristic | Conditional Sharp/Romaniuk rule. |
| Never-do line 114 rewritten: ban brand intros and logo cards, require the cue or name inside the hook | BK11-K3 | strategic_preference | Old wording banned the name, which conflicts with early branding. |
| Checklist line | BK11-K3 | — | Enforces the above. |

## Rejected or deferred

| Proposal | Reason |
|---|---|
| BK10-K5 soften intent penalty in scoring for reach channels | Code change in `shared/acquisition/scoring.ts`, not a skill change. |
| BK11-K4 required-response-rate arithmetic in the skill | Must be computed in code; deferred to a calculator. |
| BK11-K4 "add a second platform only if it reaches different people" | Planner/channel selection, not ad drafting. |
| "Owner's face" as default asset | Only when the owner agrees to appear (existing asset inputs). |
