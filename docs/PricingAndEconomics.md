# Pricing and economics

ClimbOS prices are set so that every plan keeps at least a **30% gross margin at its maximum included usage, even under a combined downside stress test**. This document explains the numbers, where they come from, and how the software enforces them. The source of truth is code, not this document:

| What | Where |
|---|---|
| Versioned vendor rates (research snapshot + later versions) | `shared/economics/rates.ts` |
| Model routing per role (blueprint fixture + production) | `shared/economics/roles.ts` |
| Editable assumptions (workbook "Assumptions" sheet) | `shared/economics/assumptions.ts` |
| Calculator (workbook Costs/Agents/Summary sheets) | `shared/economics/calculator.ts` |
| Published plan caps (entitlement registry) | `shared/economics/entitlements.ts` |
| Usage ledger (reservations, wallet + task quotas) | `shared/economics/ledger.ts` |
| Top-up economics | `shared/economics/topups.ts` |
| Polar seller-plan comparison | `shared/economics/polarPlans.ts` |
| CSV export | `pnpm econ:export [--rates <versionId>] [--out file.csv]` |
| Regression fixture (workbook values) | `tests/fixtures/workbook-2026-10-17.ts`, `tests/unit/economics.test.ts` |

The XLSX workbook (`ClimbOS-Cost-Calculator.xlsx`) is a planning reference. The application never reads a spreadsheet at runtime.

## Plans

| Plan | Price / month | Brands · seats · connections | Social posts | Images (attempts) | Web searches | Pages read | Support |
|---|---:|---|---:|---:|---:|---:|---:|
| Basic | $19 | 1 · 1 · 2 | 4 | 3 (7) | 4 | 12 | 2 min |
| Starter | $169 | 1 · 1 · 3 | 42 | 31 (63) | 42 | 105 | 20 min |
| Growth | $449 | 1 · 3 · 6 | 120 | 90 (180) | 120 | 300 | 50 min |
| Pro | $999 | 3 · 8 · 15 | 300 | 225 (450) | 300 | 750 | 120 min |
| Business | $2,299 | 5 · 20 · 30 | 720 | 540 (1,080) | 720 | 1,800 | 240 min |

- Every plan includes all ten AI roles. The amount of work scales by plan.
- Caps are monthly maxima, not promises of output. A failed image attempt still counts as an attempt.
- Internal monthly AI wallets (text + images, including the stress allowance) round down to **$2 / $20 / $58 / $145 / $349**. Both the task-count quota and the wallet must pass for a job to start.
- Approval modes: Basic is Copilot only (ClimbOS drafts, you publish). Starter adds Review-before-execution. Growth and above add Bounded Autopilot.
- **Extra capacity pack: $29**, bought only by clicking in Settings → Billing. It authorizes at most **$10 of stressed incremental total delivery cost** (AI, image retries, research, compute and support the work induces). Margin at the stress fee rate: **~54%**. ClimbOS never charges overages automatically.
- Ad spend is paid directly to Google or Meta. A customer's own email-provider bill is paid directly to that provider. Neither is ClimbOS revenue or COGS.

### The $19 Basic plan (owner request, 17 Oct 2026)

The owner asked for a package under $20 with limited features. Basic uses a workload factor of **0.04×** Growth, guarantees one strategy (CEO) run and one marketing-plan (CMO) run each month (costed explicitly), and allows 2 support minutes per month (help docs and email).

**Allocation policy change (documented, tested).** The workbook's stress test spreads the $111.25/month shared fixed footprint across just 10 customers, a flat **$11.13 per customer**. Under that rule, no plan priced below roughly $40 can reach 30% stressed margin, whatever its usage caps. For Basic only, the shared fixed cost is allocated in proportion to price: `per-customer share × min(1, price / Starter price)`, which is 19/169 of the share. All other plans keep the workbook's per-customer rule. A test (`strict per-head allocation at ten customers would fail Basic`) records this trade-off. **Basic should be sold alongside paid tiers, not as the only plan at a ten-customer launch.**

## Modeled margins (verified rates, production routing)

Gross margin = (list price × (1 − 1% refund reserve) − direct COGS − Polar fees) ÷ recognized revenue.

| Plan | Low COGS | Base COGS | Heavy COGS | Low / base / heavy margin | Heavy stress margin | Stress price floor |
|---|---:|---:|---:|---|---:|---:|
| Basic | $2.77 | $3.51 | $5.73 | 85.3% / 81.3% / 69.5% | 34.3% | $17.64 |
| Starter | $20.02 | $27.18 | $47.71 | 88.0% / 83.8% / 71.5% | 36.6% | $150.46 |
| Growth | $50.75 | $70.31 | $127.18 | 88.6% / 84.2% / 71.4% | 40.2% | $373.66 |
| Pro | $114.47 | $162.75 | $303.68 | 88.4% / 83.5% / 69.3% | 36.6% | $889.97 |
| Business | $259.01 | $368.88 | $695.11 | 88.6% / 83.8% / 69.5% | 37.2% | $2,026.87 |

The Starter–Business rows reproduce the workbook to the micro-dollar. A regression test asserts all 12 workbook rows, the stress rows, the caps and the minimum prices.

**Stress envelope** (all at once): full heavy quotas, 20% discount, 2× text and image costs, 2× hosting/storage/analytics/integration/observability, 1.5× support, only 10 paying customers, 100% non-US cards and 25% checkout tax. Research and platform email stay at modeled rates. This is a margin test, not a 30% markup test (a 30% markup yields only 23.1% margin).

**Gemini 3.8 Flash reprice on 1 Jan 2027.** The input/output price doubles. The `gemini-flash-reprice-2027-01-01` rate version still passes the gate, with heavy stress margins of 32.3% (Basic), 34.6% (Starter), 38.0% (Growth), 34.1% (Pro) and 34.6% (Business).

## Formulas

```
a = f × (1 + t) + p           f = Polar % + 1.5% × international mix; t = tax on top; p = payout/FX reserve
R = P × (1 − q)               recognized revenue (q = refund reserve)
F = a × P + k                 payment cost (fees apply to the taxed checkout total; k = $0.50)
Gross margin = (R − C − F) / R
Minimum price P = (C + k) / [(1 − q)(1 − m) − a]     (denominator must be > 0, else error)
Minimum list price under discount d = P / (1 − d)
```

Defaults are Polar Starter (5% + $0.50), 50% non-US cards (+1.5%), 10% effective checkout tax, a 1.25% payout/FX reserve on pre-tax sales, and $2.25 of fixed monthly payout cost in the shared footprint. No Stripe fees apply: Polar is the merchant of record. `cheapestPolarPlan()` compares Polar's paid seller plans using actual transaction count and volume.

## Rounding policy

- Line items are rounded once, half away from zero, to the nearest **micro-USD** (1e-6). Totals are exact integer sums of rounded lines.
- Reservations round **up** (ceil) so a reservation never under-protects.
- Display rounds micro-USD to cents. Display rounding never feeds back into calculations.

## How the software enforces the margin

1. **Every job is priced from a rate version** (`workflowRuns.rateVersionId`). Every subscription stores its entitlement and rate version.
2. **Atomic reservation before work.** `createRunWithReservation` (in `convex/engine.ts`) reserves the job's worst case in one serializable Convex mutation: the full input budget plus output cap for every model step, one repair, image attempts at $0.045, and searches and page reads. Concurrent jobs can't overspend (see the race test in `tests/convex/safety.test.ts`).
3. **Both limits apply.** Task-count meters and the dollar wallet must both have room. When the plan wallet can't cover a job, a purchased top-up must cover its full stressed delivery cost. A job is never split across the two.
4. **Fallback reserves again.** A cross-provider fallback must reserve its own worst case first. Without capacity, it fails closed.
5. **Reconciled exactly once.** `finishRun` reconciles reserved against actual, using provider-reported tokens and metered quantities taken from usage events (not from the caller). Uncertain outcomes keep their reservation `unresolved` until an operator resolves them.
6. **Per-run limits.** Six model steps, three research tools and one repair per run. No recursive delegation.
7. **Alerts at 70%, 90% and 100%**, once per meter per period, by email to owners and admins who opted in. At 100%, new chargeable work of that kind pauses. Reading, editing and exporting never stop.
8. **Release gate.** `marginGuard()` must pass for any new rate or entitlement configuration. `/ops` shows the gate status for the version in force.

## Unpaid workspaces

A new workspace gets a one-time starter allowance: **$0.60 AI wallet**, 6 social posts, 2 image attempts, 3 searches and 6 page reads, valid for 30 days. That's enough to research the business, build a plan and draft a first content pack. It is never re-granted after a subscription ends. The landing-page preview is capped at **$0.03 per preview**, **3 per IP per day** and a **$5/day fleet budget** (adjustable in `/ops`). Demo workspaces use fixture adapters and cost nothing.

## What isn't in gross margin

R&D, founder pay, sales and acquisition, legal and general overhead are excluded and must be funded separately. Customer ad spend and BYO sender bills are outside ClimbOS revenue and COGS. They appear in the customer's own budget views.
