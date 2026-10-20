# growth-plays: proposed revision

Diff: `growth-plays.diff` · size 18,387 → 19,896 bytes (+8%) · status: proposal. Reference file: see `growth-plays__base-rates.md`.

## Changes

| # | Change | Source refs | Rule class | Why |
|---|---|---|---|---|
| 1 | Counter-positioning needs two things: the model is profitable on its own, and a named incumbent would lose revenue by copying it. Name the like-model rivals it doesn't stop; otherwise call it a differentiator. | BK07-K4 | strategic_preference | Old wording ("what incumbents can't copy") invited false claims against small rivals |
| 2 | A price-match play shows break-even volume and the likely rival response | BK07-K7 | economic_feasibility | Price-war risk |
| 3 | Channel tests are discovery: few variants, the assumption tested, a volume ceiling vs the goal gap; a near-break-even test is a learning cost, not a scaled-ROI forecast; source tagging before launch; never inflate rates | BK15-K2, K3 | economic_feasibility | Separates tests from bankable plays and removes the pull to inflate rates to pass the economics lint |
| 4 | No cumulative counts as progress; ad-funded media exception | BK12-K1 | contextual_heuristic | Vanity rule gaps |
| 5 | Marketplaces: read liquidity first; seed supply when it's low | BK12-K4 | contextual_heuristic | Business model decides the metric |
| 6 | Stickiness unproven → paid stays a capped test; charging and first-purchase fixes always fine | BK12-K3 | strategic_preference | Same stage gate as growth-strategy |
| 7 | WOM and referral forecasts scale with the base and are partly non-incremental; not bankable under ~20 customers | BK11-K5 | contextual_heuristic | Matches PB-referrals customers_min |
| 8 | No "viral" claim without measured K ≥ 1 | BK15-K8 | contextual_heuristic | Loop maths |
| 9 | "Where the money is": don't plan growth on heavy customers buying more; context: in consumer repeat categories the volume engine recruits new and light buyers | BK11-K1, F11; BK10-K8 | contextual_heuristic | Heavy-buyer fallacy; scoped by the owner's Sharp decision. Value-targeting still wins when cheap customers can't pay back (economics decides). |
| 10 | Check tactics from older books against current platform policy | BK15-K7 | external_requirement | 2014 tactics (bought lists, cold calls) |

## Rejected or deferred

| Proposal | Decision |
|---|---|
| BK11-K4 broad targeting, reach-first media | meta-ads / social-calendar skills |
| BK11-K5 negative WOM handling, NPS ≠ WOM | Skipped for size; plays-local play 7 covers review replies |
| BK15-K7 library IDs (speaking, stunts, appreciation) | Code (library.ts) |
| BK15-K2 `test` play kind exempt from the "loses money" error | Code (specs/economics); needed so #3 isn't blocked |
| BK12-K4 Hillstrom bands | Moved to base-rates (dated) and plays-ecommerce-consumer |
