# plays-ecommerce-consumer: proposed revision

Diff: `plays-ecommerce-consumer.diff` · size +2% · status: proposal.

| # | Change | Source refs | Rule class | Why |
|---|---|---|---|---|
| 1 | Buyers: context: at least one acquisition play reaches new or light category buyers; no growth plan built on heavy buyers buying more | BK11-K1, F11; BK10-K3 | contextual_heuristic | Sharp default for consumer repeat categories (owner decision) |
| 2 | Repeat mode: compute the repeat rate in code before loyalty plays; Hillstrom (c. 2012, grade C) shown as context only | BK12-K4, F16 | contextual_heuristic | Loyalty pushes fail in acquisition mode; the band is never a threshold |
| 3 | Availability: be present where buyers already shop; add channels by occasions covered and economics; don't drop a buying channel without source data | BK11-K6 | contextual_heuristic + economic_feasibility | Make sure buyers can find and buy before adding demand |
| 4 | Loops: K = invites × conversion (code); K < 1 → seeded × 1/(1−K) and needs seeding; no viral claim without measured K ≥ 1; in-app referral's K-factor line points to it | BK15-K8 | contextual_heuristic | K was tracked but not reasoned about |

## Rejected or deferred

| Proposal | Decision |
|---|---|
| BK15-K8 `viralCoefficient` / `seededTotal` helpers | Code (shared/growth/calc.ts) |
| BK12-K4 marketplace liquidity | Placed in growth-plays (applies across segments) |
| BK11-K6 "no exclusivity by restricting distribution" vs the waitlist-drops play | No change: that play already requires real scarcity |
