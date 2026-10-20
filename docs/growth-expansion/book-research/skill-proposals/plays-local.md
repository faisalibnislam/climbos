# plays-local: proposed revision

Diff: `plays-local.diff` · size +2% · status: proposal. Play ranks and header scores are unchanged.

| # | Change | Source refs | Rule class | Why |
|---|---|---|---|---|
| 1 | Leaky-bucket rule adds an availability check (listed where buyers search and book, right services, hours and area, easy to find) | BK11-K6 | contextual_heuristic | Make sure buyers can find and book before adding demand |
| 2 | Route density: cluster acquisition by area (plays 12, 19, 21); cost per job and drive time by area | BK07-K2 | contextual_heuristic | The one scale economy a local firm can build |
| 3 | Repeat verticals: context: at least one play reaches light or non-buyers; loyalty, VIP and rebooking plays don't carry growth alone; no 80/20, no VIP sizing from one period. Emergency trades: capture demand first. Fully booked: capacity first. | BK10-K3, K8; BK11-K1 | contextual_heuristic | Sharp default for consumer repeat; owner's applicability split |
| 4 | Play 10 referrals: bankable only with ~20+ customers; partly non-incremental | BK11-K5 | contextual_heuristic | Matches PB-referrals |
| 5 | Play 11 loyalty card: track total visits per customer vs prior period or holdout; completion isn't added sales; treat as predictability 3 for growth until a holdout reads out | BK10-K7, F31 | missing_prerequisite | Member-vs-non-member and completion comparisons are biased |
| 6 | Play 20 SMS VIP: member revenue is partly selection; compare with a holdout or the same customers before joining | BK10-K7, F15 | missing_prerequisite | Same |

## Rejected or deferred

| Proposal | Decision |
|---|---|
| BK09a-K8 label the response-time figure as dated | Already done: play 2 says "(2007 vendor study)" |
| BK09a-K8 lead-form qualifiers | landing-pages skill |
| BK11-K5 negative review → fix and respond | Already covered by play 7 |
| BK11-K6 no exclusivity by restricting distribution | No local play does this |
| BK10-K7 diagnosis playStage loyalty → retention | Code (diagnosis.ts) |
