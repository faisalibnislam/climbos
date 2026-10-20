# positioning: proposed revision

Diff: `positioning.diff` · size 9,934 → 12,081 bytes (+22%) · status: proposal.

## Changes

| # | Change | Source refs | Rule class | Why |
|---|---|---|---|---|
| 1 | New "Choose the mode" block before step 6. Niche differentiation (Dunford) is the default for B2B/SaaS, considered purchases, early stage (<~20 customers) and capacity-limited services. Category buyer (Sharp) is the default for consumer repeat-purchase and everyday local services with spare capacity. Record why. | BK10-K4, K8; BK11-K2; owner decision 2026-10-20 | contextual_heuristic | Dunford (BK14, BK03) and Sharp (BK10, BK11) treated as a mode choice. Neither replaces the other. |
| 2 | Category-buyer mode: segment may be "all category buyers in [area]"; the segment shapes copy and offers, not media reach; lead with common buying situations | BK10-K4, BK11-K2 | contextual_heuristic | Old lines 38, 57 and 70 contradicted Sharp for the categories his evidence covers |
| 3 | Tie-break: both fit (new café) → start niche, consistent cues, grow area by area; which wins is unknown (bench) | BK10-K8, K4 (unknown_to_investigate) | contextual_heuristic | Owner: Sharp is a heuristic for early-stage products |
| 4 | Big Fish is the default in niche mode (was "almost every small business") | BK10-K4 | contextual_heuristic | Follows from #1 |
| 5 | Parity attributes removed from differentiation claims only; a differentiator is a benefit, and durable only with a barrier | BK11-K2, BK07-K1 | contextual_heuristic | Parity buying situations are valid message content |
| 6 | Swap test is advisory for claims in category-buyer mode; brand cues still must be distinctive | BK10-K4, BK11-K2 | contextual_heuristic | Keeps the test where it still means something |
| 7 | Brand-cue check; fame and uniqueness marked "unmeasured" without a survey | BK10-K4 | missing_prerequisite | Adds distinctive brand cues without inventing metrics |
| 8 | Step 6: the chosen Job's struggle = trigger, its outcome = lead theme | BK08-K3 | strategic_preference | Links the Forget the Funnel Job choice to Dunford's segment |
| 9 | Launch: category, name and where to buy before differentiation | BK11-K7 | contextual_heuristic | Category clarity at launch |
| 10 | Statement is an internal summary; the hierarchy and pitch ship | BK14-K2 | contextual_heuristic | Agrees with BK03 |
| 11 | Pitch v2: only for considered purchases (else skip and say why); full order: insight from value (not a trend) → alternatives as approaches, tagged → perfect world + agreement check → introduction → ≤3 themes + proof → optional unspoken objections → one ask; cost-of-problem in code; plumber line only for high-ticket local jobs | BK14-K1, K3, K4; BK09a-K2 | contextual_heuristic | Old step lacked Introduction and Objections and called a trend an insight, a mistake Dunford names |
| 12 | Description, quality bar and checklist synced | — | — | Consistency |

## Rejected or deferred

| Proposal | Decision |
|---|---|
| BK11-K2 CEP tags across 4–8 week calendars; mental-availability metrics | social-calendar skill; calculators are code |
| BK13-K7 "was" price rule | copy-fundamentals / landing-pages (external_requirement) |
| BK14-K2 pitch marked stale when PositioningVersion changes | Code |
| BK14-K3 setup ≤ 1/5 of call time | sales-follow-up |
| BK07-K2 Power types in positioning | Rejected; one line on benefit vs barrier is enough |
| BK14 edits to docs/growth-expansion/guides/03_positioning.md and docs/research/strategy-positioning.md | Not skills; route to the docs owner |

## Companion changes needed

- `positioning/rubric.json`: gate G3 (swap test) needs the category-buyer exception. The segment criterion's anchor 1 scores "everyone" as 1. The messaging anchor 5 requires a pitch narrative, so it needs "or a skip reason".
- Bench: add cases for each mode (café, niche B2B, new café tie-break).
