# plays-saas-b2b: proposed revision

Diff: `plays-saas-b2b.diff` · size +2% · status: proposal.

| # | Change | Source refs | Rule class | Why |
|---|---|---|---|---|
| 1 | B2B evidence: under ~30 customers report counts, research every account, no significance tests; integration and custom hours per customer; disentangle a dominant customer before scale; mandated logins ≠ satisfaction; baseline before deployment; references are B2B word of mouth | BK12-K8, F52, F53 | contextual_heuristic + strategic_preference | The catalogue covered channels, not how B2B evidence differs |
| 2 | Sales hires: context: founder-led selling first; hire only after a stable owner win rate and successful clients; cost from the owner's rates in code | BK09a-K1, BK09b-K8 | strategic_preference (as context) | Stops scaling sales too early; Kazanjy's 20–30% cost-of-sales band is venture SaaS, so it isn't used |
| 3 | Reach: context: "reach all category buyers" means covering the reachable account list over time from owner-sourced or public data; niche positioning stays the default | BK10-K8 | external_requirement + contextual_heuristic | Owner decision: Sharp is a heuristic for niche B2B; no prospect database is assumed |

## Rejected

| Proposal | Decision |
|---|---|
| BK12-F53 "top 20% of customers = 150–300% of profits" | Not added: a 2001 study, cited second-hand |
| BK12-K8 lint blocking significance tests under ~30 customers | Code (lint.ts) |
