# Forecasting and measurement

**Language models never produce numbers in ClimbOS.** Statistics code in `shared/forecasting` and `shared/attribution` computes every figure. The AI Data Analyst only explains values it is given.

## Data contract

- **Revenue events** (`revenueEvents`): tenant, source, source event id (deduplicated per tenant + source), occurred-at, customer/order refs, currency, integer minor-unit amount, refunded amount, kind and UTM fields. They come from Stripe (read-only restricted key) or a validated CSV (exact decimal-to-minor conversion respecting each currency's exponent; duplicates and bad rows reported).
- **Daily metrics** (`metricDaily`): materialized per tenant, metric and date (business timezone), with source, kind (`observed`, `attributed`, `platform_reported`), ingested-at (freshness) and an `isFixture` flag. Screens and forecasts read these rows, never raw histories.
- **Definitions** (`convex/analytics.ts › METRICS`): visits, sign-ups, new paying customers, and revenue net of refunds. Each has a label, unit, definition and source shown in the UI.
- **Currencies.** Never mixed without a dated FX rate. Revenue is reported in the workspace currency; other currencies stay separate.

## Attribution (`shared/attribution`)

- Billing revenue is the **source of truth**. Revenue is credited to the last (default) or first tracked touch within 30 days before the event. Revenue with no eligible touch stays in an explicit **Unattributed** bucket.
- **Reconciliation.** Attributed plus unattributed must equal total net billing revenue per currency, with exact integer equality. The UI shows the result.
- **Ad-platform claims** (Google and Meta) are summarized separately, labeled *platform reported*, and come with an overlap warning. `totalRevenueFromClaims()` deliberately throws.
- **ROAS** = attributed revenue ÷ ad spend. **ROI / contribution** = (attributed revenue − ad spend − other costs) ÷ (ad spend + other costs). Both return null on a zero denominator. Attribution shows **association, not cause**; incremental lift needs a holdout experiment.

## Forecast engine

| Piece | Implementation |
|---|---|
| Baselines | Seasonal naive (weekly), naive, drift, moving average (`baselines.ts`) |
| Backtest | Rolling origins at 7, 30 and 90-day horizons. Training data is strictly before each origin, enforced by a leakage guard that throws. Compared with seasonal naive on MAE, WAPE (null when the denominator is 0) and MASE (`backtest.ts`). |
| Intervals | Empirical split-conformal quantiles of absolute out-of-sample errors per 7-day horizon bucket. 80% and 95%. Widths never decrease with horizon (`intervals.ts`). |
| Calibration gate | At least 56 days of history and at least 20 residuals per bucket. Otherwise `insufficient_evidence` and **no numeric interval** is shown. |
| Held-out check | Interval coverage is measured on the most recent `max(28, 20%)` days before a forecast is labeled calibrated. Coverage is reported to the owner. |
| Warnings | Input drift (last 28 days vs the 28 before, more than 3 pooled SE) and source outage (trailing zero run) |
| Reproducibility | Deterministic methods. Simulations use a seeded mulberry32 PRNG. |

Synthetic 400-day test series (`tests/unit/forecasting.test.ts`) hit held-out coverage of 0.84 (80% interval) and 0.975 (95% interval). Across six seeds, 80% coverage ranged from 0.68 to 0.87. That spread is why intervals are only shown after the held-out check.

## Cold start: assumption-based scenarios

With no private data, Results offers a **scenario calculator** (`simulateFunnel`): visits × sign-up rate × paid rate × revenue per customer, plus lag and churn. Pure point assumptions give deterministic arithmetic **with no interval**, labeled *Assumption-based scenario*. Intervals appear only when inputs carry uncertainty from observed data (Beta posteriors from successes and trials) or explicit priors.

Regression examples (tested):
- 10,000 visits × 5% × 8% = **40** new paying accounts, × $25 = **$1,000** new-cohort MRR at maturation.
- 12,000 × 5.5% × 8.5% = **56.1** accounts, **$1,402.50**. The $402.50 difference is a scenario difference, *not* evidence of causal uplift.

## Experiments

Plans include experiments with a hypothesis, population, method (holdout, A/B split, pre-post observational, or export instructions when no supported integration exists), primary metric, guardrails, duration and stopping rule. ClimbOS doesn't claim causal uplift from attribution charts.

## Pilot acceptance targets (not sales promises)

Beat the selected naive baseline on an agreed held-out period, and get approximately nominal interval coverage with enough evaluation samples. If a model degrades or input drift exceeds policy, forecast-based optimization stops.
