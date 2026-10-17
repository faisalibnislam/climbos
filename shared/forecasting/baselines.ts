/**
 * Simple, transparent baseline forecasters. Each takes the training history
 * (oldest first, one value per contiguous day) and returns point forecasts for
 * days 1..horizon after the last observation. They produce no uncertainty;
 * intervals come from empirical backtest residuals (see intervals.ts).
 */

export type ForecastMethod = "seasonal_naive" | "naive" | "drift" | "moving_average";

/** Signature shared by all forecasters. */
export type Forecaster = (history: readonly number[], horizon: number) => number[];

function checkArgs(history: readonly number[], horizon: number, minLength: number, name: string): void {
  if (!Number.isInteger(horizon) || horizon < 1) throw new RangeError(`${name}: horizon must be a positive integer`);
  if (history.length < minLength) {
    throw new RangeError(`${name}: needs at least ${minLength} observation(s), got ${history.length}`);
  }
}

/**
 * Seasonal naive: each forecast repeats the value from the same position in
 * the last observed season, ŷ[n+h] = y[n - m + ((h-1) mod m)].
 * Assumes a stable seasonal pattern of period `seasonLength` (7 = weekly) and
 * no trend. Requires at least one full season of history.
 */
export function seasonalNaive(history: readonly number[], horizon: number, seasonLength = 7): number[] {
  checkArgs(history, horizon, seasonLength, "seasonalNaive");
  const n = history.length;
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) out.push(history[n - seasonLength + ((h - 1) % seasonLength)]);
  return out;
}

/** Naive: every forecast equals the last observed value (random-walk assumption). */
export function naive(history: readonly number[], horizon: number): number[] {
  checkArgs(history, horizon, 1, "naive");
  return new Array<number>(horizon).fill(history[history.length - 1]);
}

/**
 * Drift: extends the straight line from the first to the last observation,
 * ŷ[n+h] = y[n] + h * (y[n] - y[1]) / (n - 1). Assumes the average historical
 * change per day persists; sensitive to the endpoints. Ignores seasonality.
 */
export function drift(history: readonly number[], horizon: number): number[] {
  checkArgs(history, horizon, 2, "drift");
  const n = history.length;
  const slope = (history[n - 1] - history[0]) / (n - 1);
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) out.push(history[n - 1] + h * slope);
  return out;
}

/**
 * Moving average: flat forecast equal to the mean of the last `window` values.
 * Assumes a locally constant level. Use a multiple of the season length
 * (e.g. 7 or 28) so weekly seasonality averages out.
 */
export function movingAverage(history: readonly number[], horizon: number, window = 7): number[] {
  if (!Number.isInteger(window) || window < 1) throw new RangeError("movingAverage: window must be a positive integer");
  checkArgs(history, horizon, window, "movingAverage");
  let sum = 0;
  for (let i = history.length - window; i < history.length; i++) sum += history[i];
  return new Array<number>(horizon).fill(sum / window);
}

/** Minimum history length each method needs. */
export function minHistoryFor(method: ForecastMethod, seasonLength = 7, window = seasonLength): number {
  switch (method) {
    case "seasonal_naive":
      return seasonLength;
    case "naive":
      return 1;
    case "drift":
      return 2;
    case "moving_average":
      return window;
  }
}

/** Resolve a named method to a {@link Forecaster}. `window` applies to moving_average (defaults to seasonLength). */
export function getForecaster(method: ForecastMethod, seasonLength = 7, window = seasonLength): Forecaster {
  switch (method) {
    case "seasonal_naive":
      return (h, k) => seasonalNaive(h, k, seasonLength);
    case "naive":
      return naive;
    case "drift":
      return drift;
    case "moving_average":
      return (h, k) => movingAverage(h, k, window);
  }
}
