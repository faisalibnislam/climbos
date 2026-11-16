import { expect, it } from "vitest";
import { addDays, calibrateIntervals, rollingOriginBacktest, runForecast, type ResidualRecord } from "../../shared/forecasting";

it("evaluates interval coverage only for forecasts issued after all calibration outcomes were available", () => {
  const dates = Array.from({ length: 100 }, (_, i) => addDays("2026-01-01", i));
  const record = (origin: number, step: number, residual: number): ResidualRecord => ({ originDate: dates[origin], targetDate: dates[origin + step - 1], step, actual: 10 + residual, forecast: 10, residual });
  const calibration = Array.from({ length: 25 }, (_, i) => record(55 + i, 1, 1));
  // The cutoff is day 80. These targets are later, but their forecasts started
  // before calibration was complete; evaluating them would use future data.
  const crossing: ResidualRecord[] = [];
  for (let origin = 74; origin < 80; origin++) for (let step = 1; step <= 7; step++) if (origin + step - 1 >= 80) crossing.push(record(origin, step, 100));
  const valid = Array.from({ length: 20 }, (_, i) => record(80 + i, 1, 0));
  const result = calibrateIntervals({ residualRecords: [...calibration, ...crossing, ...valid], horizon: 7, historyDays: 100, historyDates: dates, heldOutDays: 20 });
  expect(result.status).toBe("calibrated");
  expect(result.heldOut).toMatchObject({ startDate: dates[80], count: 20, coverage80: 1, coverage95: 1 });
  const sparse = calibrateIntervals({ residualRecords: [...calibration, ...crossing, ...valid.slice(0, 2)], horizon: 7, historyDays: 100, historyDates: dates, heldOutDays: 20 });
  expect(sparse.heldOut).toMatchObject({ count: 2, coverage80: null, coverage95: null });
});

it("uses the same chronological cutoff in the actual forecast and records the coverage method", () => {
  const series = Array.from({ length: 180 }, (_, i) => ({ date: addDays("2026-01-01", i), value: 10 + i % 7 }));
  const forecast = runForecast({ series, horizonDays: 30, method: "seasonal_naive", nonNegative: true });
  const cutoff = forecast.calibration.heldOutStartDate!;
  expect(cutoff).toBeTruthy();
  const backtest = rollingOriginBacktest({ series, method: "seasonal_naive", residualHorizon: 30 });
  expect(forecast.calibration.heldOutCount).toBe(backtest.residualRecords.filter(row => row.step <= 30 && row.originDate >= cutoff && row.targetDate >= cutoff).length);
  expect(forecast.calibration).toMatchObject({ heldOutMethod: "origin_after_calibration_v1" });
  expect(forecast.assumptions.join(" ")).toContain("not independent");
});
