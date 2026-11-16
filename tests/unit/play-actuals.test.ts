import { describe, expect, it } from "vitest";
import { costCheck, playActuals, PRIOR_WEIGHT, resultsLine } from "../../shared/growth/actuals";

const model = { weeklyReach: 250, steps: [{ name: "reply", rate: 0.02 }, { name: "trial", rate: 0.5 }, { name: "paid", rate: 0.3 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 };
const forecast = { p10: 4, p50: 9.75, p90: 18 };
const week = (i: number, reach: number, steps: number[]) => ({ weekStart: Date.UTC(2026, 9, 19) + i * 7 * 86_400_000, reach, steps, spendUsd: 0, ownerHours: 1 });

describe("play results vs plan", () => {
  it("does not invent a completed window before a new plan starts", () => {
    const startWeek = week(0, 0, [0, 0, 0]).weekStart;
    const actuals = playActuals(model, [], forecast, 13, { startWeek, throughWeek: startWeek - 7 * 86400000 });
    expect(actuals).toMatchObject({ weeks: 0, weeksSinceStart: 0, unloggedWeeks: 0 });
    expect(actuals.throughWeek).toBeUndefined();
    expect(resultsLine("New plan", actuals)).toContain("customer counts, spending and hours are unknown");
  });
  it("keeps open-week reports provisional and only judges completed reporting windows", () => {
    const rows = [week(0, 250, [20, 10, 5]), week(1, 250, [20, 10, 5])];
    const provisional = playActuals(model, rows, forecast, 13, { startWeek: rows[0].weekStart, throughWeek: rows[1].weekStart, currentWeekIncluded: true });
    expect(provisional).toMatchObject({ status: "partial_week", expectedByNow: null, comparisonIssue: expect.stringContaining("still open") });
    const complete = playActuals(model, rows, forecast, 13, { startWeek: rows[0].weekStart, throughWeek: rows[1].weekStart, currentWeekIncluded: false });
    expect(complete.status).toBe("ahead");
  });
  it.each([{}, { p10: null, p50: 10, p90: 20 }, { p10: 5, p50: 4, p90: 20 }, { p10: 0, p50: NaN, p90: 20 }])("keeps missing or invalid original forecasts unknown: %j", forecast => {
    const actual = playActuals(model, [week(0, 100, [10, 5, 2]), week(1, 100, [10, 5, 2])], forecast);
    expect(actual).toMatchObject({ expectedByNow: null, status: "forecast_unknown" });
    expect(resultsLine("Original", actual)).toContain("Original forecast unavailable");
  });
  it("does not relabel unknown or mixed historical spending as current-currency acquisition cost", () => {
    const legacy = playActuals(model, [{ ...week(0, 250, [6, 3, 1]), spendUsd: 100 }], forecast);
    expect(legacy.spendUsd).toBeNull();
    expect(costCheck(legacy, 200).status).toBe("spend_unknown");
    expect(resultsLine("Legacy", legacy)).toContain("spend unavailable");
    const mixed = playActuals(model, [
      { ...week(0, 250, [6, 3, 1]), spendUsd: 100, spendCurrency: "USD" },
      { ...week(1, 250, [6, 3, 1]), spendUsd: 100, spendCurrency: "BDT" },
    ], forecast);
    expect(mixed.spendUsd).toBeNull();
    expect(mixed.spendIssue).toContain("different currencies");
  });

  it("uses exact currency precision and refuses to compare a different workspace currency", () => {
    const rows = [{ ...week(0, 250, [6, 3, 1]), spendUsd: 12.345, spendCurrency: "KWD" }];
    const known = playActuals(model, rows, forecast);
    expect(known).toMatchObject({ spendUsd: 12.345, spendCurrency: "KWD", spendIssue: null });
    expect(resultsLine("Known", known)).toContain("12.345");
    expect(resultsLine("Known", known)).not.toContain("$12");
    const changed = playActuals(model, rows, forecast, 13, { currency: "USD" });
    expect(changed.spendUsd).toBeNull();
    expect(costCheck(changed, 100).status).toBe("spend_unknown");
    const invalid = playActuals(model, [{ ...rows[0], spendUsd: -1 }], forecast);
    expect(invalid.spendUsd).toBeNull();
    const excessPrecision = playActuals(model, [{ ...rows[0], spendUsd: 12.3456 }], forecast);
    expect(excessPrecision.spendUsd).toBeNull();
  });
  it("computes observed rates and blends them with the plan", () => {
    const a = playActuals(model, [week(0, 250, [6, 3, 1]), week(1, 250, [4, 2, 1])], forecast);
    expect(a.weeks).toBe(2);
    expect(a.reach).toBe(500);
    expect(a.customers).toBe(2);
    expect(a.steps[0]).toMatchObject({ trials: 500, successes: 10, observed: 0.02 });
    expect(a.steps[1]).toMatchObject({ trials: 10, successes: 5, observed: 0.5 });
    expect(a.steps[0].updated).toBeCloseTo((0.02 * PRIOR_WEIGHT + 10) / (PRIOR_WEIGHT + 500), 10);
    expect(a.reachVsPlan).toBe(1);
  });

  it("says too early, ahead or behind", () => {
    expect(playActuals(model, [week(0, 250, [5, 2, 1])], forecast).status).toBe("too_early");
    expect(playActuals(model, [week(0, 250, [20, 10, 5]), week(1, 250, [20, 10, 5])], forecast).status).toBe("ahead");
    // 4 weeks, reply rate 0.2% vs 2% planned, no customers: behind.
    const weak = [0, 1, 2, 3].map((i) => week(i, 250, [0, 0, 0]));
    expect(playActuals(model, weak, forecast).status).toBe("behind");
  });

  it("does not label a play on track or behind when elapsed weeks are missing from the log", () => {
    const rows = [week(0, 250, [0, 0, 0]), week(3, 250, [0, 0, 0])];
    const a = playActuals(model, rows, forecast, 13, { startWeek: week(0, 250, [0, 0, 0]).weekStart });
    expect(a).toMatchObject({ weeks: 2, weeksSinceStart: 4, unloggedWeeks: 2, status: "incomplete_log" });
    expect(resultsLine("Outreach", a)).toContain("2 elapsed weeks are unlogged; missing weeks are unknown, not zero");
  });

  it("writes a factual line for the next plan", () => {
    const line = resultsLine("Agency outreach", playActuals(model, [week(0, 250, [6, 3, 1]), week(1, 250, [4, 2, 1])], forecast));
    expect(line).toContain("reply 10/500 (2%, planned 2%)");
    expect(line).toContain("2 new customers");
  });
});
