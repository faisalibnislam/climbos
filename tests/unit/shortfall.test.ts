import { describe, expect, it } from "vitest";
import { playActuals, type ResultEntry } from "../../shared/growth/actuals";
import { diagnoseShortfall, shortfallLine } from "../../shared/growth/diagnostics";

/** Cycle 2: a play that's behind is diagnosed in order before anyone adds spend. */
const model = { weeklyReach: 200, steps: [{ name: "click", rate: 0.1 }, { name: "pay", rate: 0.2 }], monthlySpendUsd: 100, ownerHoursPerWeek: 1 };
const forecast = { p10: 20, p50: 40, p90: 60 };
const week = (i: number, reach: number, steps: number[]): ResultEntry => ({ weekStart: i * 7 * 86_400_000, reach, steps, spendUsd: 25, ownerHours: 1 });
const a = (entries: ResultEntry[]) => playActuals(model, entries, forecast, 13);

describe("shortfall diagnosis", () => {
  it("not run: no reach says nothing about the channel", () => {
    expect(diagnoseShortfall(a([])).verdict).toBe("not_run");
    expect(diagnoseShortfall(a([week(1, 0, [0, 0]), week(2, 0, [0, 0])])).verdict).toBe("not_run");
  });
  it("tracking: people reached but nothing recorded", () => {
    expect(diagnoseShortfall(a([week(1, 200, [0, 0]), week(2, 200, [0, 0])])).verdict).toBe("tracking");
  });
  it("conversion: names the failing step and never suggests more spend", () => {
    const s = diagnoseShortfall(a([week(1, 200, [6, 1]), week(2, 200, [5, 1])]), { killIf: "under 2% click after 4 weeks" });
    expect(s.verdict).toBe("conversion");
    expect(s.next).toMatch(/Fix "click"/);
    expect(s.next).toMatch(/Your stop rule: under 2% click/);
    expect(s.moreSpendJustified).toBe(false);
    expect(shortfallLine("Ads test", s)).toMatch(/Don't raise its spend/);
  });
  it("reach only: more spend is justified only when logged cost per customer is affordable", () => {
    // 4 weeks × 25 spent = 100 for 5 customers: 20 per customer.
    const actuals = a([week(1, 60, [7, 2]), week(2, 50, [6, 1]), week(3, 60, [6, 1]), week(4, 50, [5, 1])]);
    const within = diagnoseShortfall(actuals, {}, { affordableCacUsd: 50, currency: "USD" });
    expect(within.verdict).toBe("reach_only");
    expect(within.moreSpendJustified).toBe(true);
    expect(within.checks.find((c) => c.check === "cost")).toMatchObject({ status: "pass", detail: expect.stringContaining("$20") });

    const above = diagnoseShortfall(actuals, {}, { affordableCacUsd: 10, currency: "USD" });
    expect(above).toMatchObject({ verdict: "reach_only", moreSpendJustified: false });
    expect(above.next).toMatch(/above what a customer is worth/);
    expect(above.checks.find((c) => c.check === "cost")?.status).toBe("fail");

    // Unknown customer value: don't assume spend is justified.
    const unknown = diagnoseShortfall(actuals);
    expect(unknown.moreSpendJustified).toBe(false);
    expect(unknown.next).toMatch(/confirm price, margin and churn/);
    expect(shortfallLine("Referral test", unknown)).toMatch(/Don't raise its spend/);
  });
  it("reach only with no logged spend doesn't recommend starting paid spend", () => {
    const free = playActuals(model, [1, 2, 3, 4].map((i) => ({ ...week(i, i % 2 ? 60 : 50, [6, 1]), spendUsd: 0 })), forecast, 13);
    const s = diagnoseShortfall(free, {}, { affordableCacUsd: 50 });
    expect(s).toMatchObject({ verdict: "reach_only", moreSpendJustified: false });
    expect(s.next).toMatch(/don't start or raise paid spend/);
  });
  it("too few: keep running to the planned end", () => {
    expect(diagnoseShortfall(a([week(1, 150, [10, 1]), week(2, 140, [9, 1])])).verdict).toBe("too_few");
  });
});
