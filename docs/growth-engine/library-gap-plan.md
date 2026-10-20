# Engine vs Growth Intelligence Library (Books 13, 14)

Reviewed 2026-10-20 against `growth-engine-v2`. Evidence is file:line at that time. P0 is built (see evaluation-and-cost.md); the rest is backlog.

| # | Gap | Book | Status |
|---|---|---|---|
| **P0: truth and numbers** | | | |
| 1 | Unsourced numbers (`invented_fact`) weren't a hard failure | 13 §11, 14 §13 | Built |
| 2 | Only the North Star number was checked against the calculations | 14 §7 | Built |
| 3 | Budget treated as USD whatever the currency | 14 §4 | Built |
| 4 | No facts, research or skill versions saved per plan version | 13 §3, 14 §4–5 | Built |
| 5 | Plan approval hash was `strategy:id:vN`, not the plan's content | 14 §10 | Built |
| 6 | `generationCostMicros` was always 0 | 14 §9 | Built |
| 7 | Hours and email audience were assumed, not marked unknown | 14 §4 | Built |
| **P1: decision quality** | | | |
| 8 | Claims don't link to evidence ids; only play inputs have a URL and quote | 13 §3, 14 §5 | Built: channels and audiences |
| 9 | No register of conflicting sources (e.g. two prices) | 14 §5 | Built: prices and trial length |
| 10 | Whole skill files go into every prompt; nothing is selected by business type, stage or channel | 14 §6 | Backlog (needs a bench check) |
| 11 | `webFetch` is requested but never sent to OpenAI; the model sees search snippets only | 13 §3 | Backlog |
| **P1: evaluation** | | | |
| 12 | All 5 bench cases are B2B SaaS. bench/cache already has 8 others | 14 §13 | Backlog (paid) |
| 13 | Hard failures aren't part of the bench score | 13 §11 | Backlog |
| 14 | No tests that change one input (budget $600 → $60, no email list, new price) | 14 §13 | Backlog (paid) |
| **P2 and P3** | | | |
| 15 | Cold email has no stable idempotency key | 13 §7 | Backlog |
| 16 | Experiment results are free text, with no correlation vs cause label | 14 §14 | Backlog |

**Already in place:**
- Forecasts and cost per customer are calculated in code.
- Run cost is reserved first, then settled.
- Each step has idempotency keys and leases.
- Publishing and ads re-check a content-hash approval and have receipts and reconciliation.
- Webhooks are signed and deduplicated.
- Weekly results are compared with the forecast.

**Open questions:**
- Workspaces with a zero-decimal currency (e.g. JPY) saved before this change hold budgets ×100. Check prod before relying on them.
- Website prices are read as the workspace currency.
