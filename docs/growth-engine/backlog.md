# Implementation backlog

Each item needs owner approval before it changes runtime behaviour. Sizes: S < ½ day, M ≈ 1 day, L = 2–3 days.

## Phase A: measure (free, no runtime change)

| # | Item | Size |
|---|---|---|
| A1 | ✅ Calculator module (`shared/growth/calc.ts`) + spec §18 fixture tests | S |
| A2 | ✅ Context-size probe on saved bench inputs (H2) | S |
| A3 | ✅ Website-depth probe on 5 Airly sites (H5) | S |
| A4 | ✅ `bench/run.ts`: `--max-usd` cap, `--blind` review packet, 5 Airly cases, production's exact tasks. Old engine = run the bench in a git worktree at `bd071ca` | M |

## Phase B: smallest fixes (one change each, reversible)

| # | Fix | Defect | Size |
|---|---|---|---|
| B1 | ✅ Done 2026-10-18. Number-trace evidence includes every prompt block; message becomes "cite or label as assumption", not "remove" | D1 | S |
| B2 | ✅ Done 2026-10-18. No silent cuts: budgeted context, log what's dropped | D2 | S |
| B3 | ✅ Owner unit economics override guesses; `assumed[]`; ≤3 questions, asked only if an answer flips a verdict | D3, D4 | M |
| B4 | ✅ Research pages saved with the plan and shown; funnel citations must be sources actually read | D5 | M |
| B5 | ✅ Plays give inputs with ranges; code computes P10/P50/P90 (seeded simulation), CAC, payback with churn, break-even per reach; 20% overlap | D6, D7 | M |
| B6 | ✅ Engine Lab: feedback redacted, ≤4 fixes per workspace, rule needs 5+ businesses; unpaused (`ENGINE_LAB_PROPOSALS=off` kills it) | D10 | S |
| B7 | ✅ `engineQuality` log per agent run; /ops engine page shows draft→final errors, untraced numbers, numbers lost, ship rate | D9 | S |

## Phase C: compare (needs eval budget)

| # | Item | Size |
|---|---|---|
| C1 | ✅ Arm C in bench (`single`, `single-expert`) | M |
| C2 | Run A/B0/B1/C on 5 Airly cases; owner blind review | M |
| C3 | Arm D (diagnose → candidates → select), only if C loses to B1 | L |
| C4 | Remove stages that didn't win (best-of-two, consistency pass, critic) | S |

## Phase D: durability and safety

| # | Item | Size |
|---|---|---|
| D1 | ✅ Plan stores its input snapshot and `ENGINE_VERSION`; quality logs carry it | M |
| D2 | ✅ Run stops before a new call once spend ≥ 1.5× reservation (alerts: not yet) | S |
| D3 | Approval records bound to content, account, budget, expiry; edits invalidate | M |
| D4 | Rendered-page fetch for JS sites. A3: not needed for the 5 Airly sites; fixed ranking and www redirects instead (5 pages each now) | M |

## Phase E: learn from outcomes

| # | Item | Size |
|---|---|---|
| E1 | Record each play's actual reach, rates and customers; feed `MetricInput` with provenance `connected` | M |
| E2 | Owner edits to plans become eval cases | S |

## Next

1. **C2 (needs budget):**
   - run `basic,expert,single,single-expert` on the 5 Airly cases with `--max-usd 25 --blind`;
   - owner scores the blind packet.
2. **C3/C4:** keep or drop the staged pipeline, best-of-two and the consistency pass on that evidence.
3. **D3:** bind approval records to exact action content (publishing, sending and spend already need approval).
4. **E1/E2:** play outcomes feed `MetricInput`; owner answers and rejections become eval cases.

## Results log

| Date | Item | Free check | Result |
|---|---|---|---|
| 2026-10-18 | B1 | `bench/lint-audit.mts` on 6 saved outputs, same inputs | `invented_fact` per plan 31–54 → 0–9; per plays output 9–32 → 1–5. Left: scorecard scores (not in offline inputs) and real untraced funnel rates |
| 2026-10-18 | B2 | Unit tests (`tests/unit/context-fit.test.ts`) | JSON stays valid; drops are logged as `[context-trim]`. Budgets: plays 32k (was 14k), insights 20k (was 14k), critic sees all research notes (was 12k; about +$0.003 per plan on Luna) |
| 2026-10-18 | A2 | Saved bench outputs | Expert plays JSON 11–14k chars before new fields; 1 of 8 exceeded the old 14k cut. Insights 11.6k |
| 2026-10-18 | A3 | Own fetcher, 5 Airly sites | Before: Involets 1 page (www redirect), others 3. After ranking fix: 5 pages each, incl. pricing and competitor-compare pages |
| 2026-10-18 | B5 | Unit tests | §18 fixture exact; simulated ranges reproducible; old plans without models still render |
