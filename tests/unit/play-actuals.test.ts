import { describe, expect, it } from "vitest";
import { playActuals, PRIOR_WEIGHT, resultsLine } from "../../shared/growth/actuals";

const model = { weeklyReach: 250, steps: [{ name: "reply", rate: 0.02 }, { name: "trial", rate: 0.5 }, { name: "paid", rate: 0.3 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 };
const forecast = { p10: 4, p50: 9.75, p90: 18 };
const week = (i: number, reach: number, steps: number[]) => ({ weekStart: Date.UTC(2026, 9, 19) + i * 7 * 86_400_000, reach, steps, spendUsd: 0, ownerHours: 1 });

describe("play results vs plan", () => {
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
