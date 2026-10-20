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
  it("reach only: conversion holds, so more reach (or spend within the cap) is justified", () => {
    const s = diagnoseShortfall(a([week(1, 60, [7, 2]), week(2, 50, [6, 1]), week(3, 60, [6, 1]), week(4, 50, [5, 1])]));
    expect(s.verdict).toBe("reach_only");
    expect(s.moreSpendJustified).toBe(true);
  });
  it("too few: keep running to the planned end", () => {
    expect(diagnoseShortfall(a([week(1, 150, [10, 1]), week(2, 140, [9, 1])])).verdict).toBe("too_few");
  });
});
