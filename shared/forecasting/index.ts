/**
 * ClimbOS forecasting: pure, deterministic statistics. Language models never
 * produce forecast numbers; this module does.
 */

export { createRng, mulberry32, type Rng, type UniformSource } from "./prng";
export {
  addDays,
  assertContiguous,
  assertNoLeakage,
  assertValidSeries,
  dateToDayNumber,
  dayNumberToDate,
  daysBetween,
  fillMissingDays,
  findMissingDates,
  isValidDateString,
  LeakageError,
  SeriesValidationError,
  sortSeries,
  splitChronological,
  splitLastN,
  validateSeries,
  type ChronologicalSplit,
  type DailyPoint,
  type FillMode,
  type FillResult,
  type SeriesValidation,
} from "./series";
export {
  drift,
  getForecaster,
  minHistoryFor,
  movingAverage,
  naive,
  seasonalNaive,
  type ForecastMethod,
  type Forecaster,
} from "./baselines";
export {
  intervalCoverage,
  mae,
  mase,
  meanIntervalWidth,
  rmse,
  seasonalNaiveScale,
  wape,
  winklerScore,
  type MetricValue,
} from "./metrics";
export {
  rollingOriginBacktest,
  type AccuracySummary,
  type BacktestOptions,
  type BacktestResult,
  type HorizonSummary,
  type ResidualRecord,
} from "./backtest";
export {
  applyIntervals,
  calibrateIntervals,
  conformalQuantile,
  cumulativeMax,
  type HeldOutCoverage,
  type IntervalBounds,
  type IntervalCalibration,
  type IntervalCalibrationOptions,
} from "./intervals";
export {
  detectInputDrift,
  detectTrailingZeroOutage,
  runForecast,
  type ForecastPoint,
  type ForecastResult,
  type RunForecastInput,
  type RunForecastMethod,
} from "./forecast";
export {
  compareScenarios,
  simulateFunnel,
  type FunnelInput,
  type FunnelResult,
  type Quantiles,
  type RateInput,
  type ScenarioComparison,
  type VisitsInput,
} from "./funnel";
export { generateSyntheticDailySeries, type SyntheticSeriesOptions } from "./synthetic";

export { scoreForecast, type ForwardScore } from "./forwardScore";
