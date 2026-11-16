# Forecasts, economics and learning: completion audit

17 November 2026. Scope: retained requirements 26–30 and relevant growth-intelligence Book 12 sections 7–9. This is a current code-path reconciliation, not acceptance of the entire product or independent evidence of predictive/business effectiveness.

## Current paths and remaining scope

| Row | Confirmed current behavior | Remaining limitation |
|---|---|---|
| 26: unsupported revenue projections | `analytics.createForecast` uses deterministic time-series baselines, saved metric/source/currency/timezone/training history and subsequent comparable observations. `getForecast` separates unavailable forward checks. Growth-plan funnel scenarios use `economics.playMaths`, with source/provenance checks and explicit assumptions. | Time-series predictions and funnel scenarios are different products; neither establishes revenue lift from a proposed tactic. General natural-language projection support and real-business forecast performance remain unproven. |
| 27: profitability | `monthlyContribution`, `customerValue` and `playMaths` use supplied contribution margin, retention, media, setup and owner-time inputs. Unknown price/margin/retention prevents a known contribution value; non-positive margins remain possible. Offer economics independently expose per-unit contribution and break-even conditions. | Defined contribution is not full accounting profit or cash flow. Unreported costs, wrong supplied inputs and retention uncertainty remain material. No new economics formulas changed in this batch. |
| 28: small datasets | Recent forecast history uses uninterrupted observed days; missing days are not zero. Empirical ranges have history/residual minimums and an unavailable-coverage state. Weekly reports preserve missing/open weeks; observations retain population and metric limits. | Overlapping rolling-origin residuals are correlated; raw count is not independent sample size. Pooled coverage is not evidence for every horizon, market regime or customer segment. |
| 29: correlation versus causation | Forecast detail separates historic backtests from later observations and warns against future guarantees. `resultsLine` and weekly comparisons distinguish descriptive low/central/high scenarios from confidence or causal success. Original experiment decision context explicitly excludes assumed exposure/attribution. | Forecast accuracy and reported before/after results do not establish causal effect. The correctness of every model interpretation is not guaranteed. |
| 30: learn from previous results | `playResults` validates original play identity, reporting windows/definitions and currencies; `resultsBriefs` reaches `jobWrites.jobContext`. Experiment learning retains original focused decisions, reported conditions and unknowns, with bounded whole-record selection. | Complete historical retrieval, semantic transfer quality and real-world learning benefit remain unproven. Owner reports are not independently verified outcomes. |

All five broad rows remain partial. The other requirements and later owner instructions remain in scope.

## Confirmed chronological evaluation gap

`calibrateIntervals` excluded residual targets after a cutoff from calibration, but evaluated all later targets regardless of when their forecasts began. A multi-step forecast issued before the cutoff could therefore be evaluated with range widths calibrated using outcomes unavailable at its own origin. The synthetic real-backtest regression counted 1,080 eligible errors under that rule versus 645 whose forecast origins actually followed the cutoff. This is temporal leakage in the interval-coverage evaluation, not evidence that the point forecasts themselves used future training data.

The held-out check now requires both forecast origin and target on/after the cutoff; calibration targets remain strictly before it. Minimum held-out counts apply after this filtering. If too few eligible errors remain, coverage stays unknown. Output records `heldOutMethod: origin_after_calibration_v1`; its assumptions identify pooled overlapping errors and avoid an independent-sample or per-horizon guarantee. Existing point prediction, quantile and interval-width calculations are unchanged.

This applies the temporal-order principle described by Hyndman and Athanasopoulos in [Forecasting: Principles and Practice, time-series cross-validation](https://otexts.com/fpptr/tscv.html), consulted 17 November 2026: evaluation must not use information from after forecast issuance. The specific diagnosis and repair above come from repository code and tests; the source is not a certification of ClimbOS's intervals or statistical assumptions.

## Saved results and owner review

`analytics.getForecast` withholds historical coverage percentages/counts when the method marker is missing or unrecognized, removes the known old coverage summary from the presented assumptions, and adds a visible warning through the existing ForecastDetail warning flow. Original points, ranges, training history and persisted JSON remain unchanged. A new forecast is needed for the repaired check; old values are not silently recomputed using newer data. Forward scoring of actual later observations remains separate.

Two numerical regressions first failed for the cutoff issue; two actual-query regressions then failed for presenting unverified historical coverage. Final verification: 59 tests across six files, root and Convex type checks, and scoped lint passed. The existing forecast tests cover missing/negative data, changed source/currency/timezone, historical windows, tenant/edit permissions and absence of workflow/approval/action side effects. Exact commands are in `docs/Verification.md`.

No browser, live-provider or paid-model evaluation ran. No deployment or model switch. Empirical range calibration still depends on exchangeability/stability assumptions; this repair does not guarantee future coverage, establish independent sample size, validate general model recommendations or complete rows 26–30 at their full scope.
