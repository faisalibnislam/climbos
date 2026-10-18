# Implementation backlog

Each item needs owner approval before it changes runtime behaviour. Sizes: S < ½ day, M ≈ 1 day, L = 2–3 days.

## Phase A: measure (free, no runtime change)

| # | Item | Size |
|---|---|---|
| A1 | Calculator module + spec §18 fixture tests (unused by runtime yet) | S |
| A2 | Context-size probe on saved bench inputs (H2) | S |
| A3 | Website-depth probe on 5 Airly sites (H5) | S |
| A4 | `bench/run.ts`: `--max-usd` cap, `--arm-ref <git ref>`, blind export for owner review | M |

## Phase B: smallest fixes (one change each, reversible)

| # | Fix | Defect | Size |
|---|---|---|---|
| B1 | Number-trace evidence includes every prompt block; message becomes "cite or label as assumption", not "remove" | D1 | S |
| B2 | No silent cuts: compact plays projection, budgeted context, log what's dropped | D2 | S |
| B3 | Nullable owner-only numbers + `assumptions[]`; ≤3 decision-changing questions after the provisional plan | D3, D4 | M |
| B4 | Save research sources with the plan; show them; reject cited URLs that weren't fetched | D5 | M |
| B5 | Plays emit inputs only; calculator produces customers, CAC, payback, allowable CAC, break-even CPC; P10/P90 become low/high from ranges | D6, D7 | M |
| B6 | Engine Lab: redact fixes, require ≥5 tenants per rule, then unpause | D10 | S |
| B7 | Run logs: context sizes, lint counts, numbers removed between draft and final | D9 | S |

## Phase C: compare (needs eval budget)

| # | Item | Size |
|---|---|---|
| C1 | Arm C: single focused call per mode with B1–B5 | M |
| C2 | Run A/B0/B1/C on 5 Airly cases; owner blind review | M |
| C3 | Arm D (diagnose → candidates → select), only if C loses to B1 | L |
| C4 | Remove stages that didn't win (best-of-two, consistency pass, critic) | S |

## Phase D: durability and safety

| # | Item | Size |
|---|---|---|
| D1 | Versioned business snapshot; plan points to snapshot id | M |
| D2 | Per-run hard cost cap; step cost alerts | S |
| D3 | Approval records bound to content, account, budget, expiry; edits invalidate | M |
| D4 | Rendered-page fetch (own headless Chrome worker, already used for reels) for JS sites, if A3 shows the need | M |

## Phase E: learn from outcomes

| # | Item | Size |
|---|---|---|
| E1 | Record each play's actual reach, rates and customers; feed `MetricInput` with provenance `connected` | M |
| E2 | Owner edits to plans become eval cases | S |

## Recommended order

B1 → B2 → B7 → A1 → B5 → B3 → B4. Then C1–C2 once a budget is approved.
