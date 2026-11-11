import { describe, expect, it } from "vitest";
import { lunaActualMicros, reserveLunaCall } from "../../bench/strategy-quality/budget";
describe("live QA spending boundary", () => {
  it("reserves before a request and refuses a call that could exceed the cumulative authorization", () => {
    const reserve = reserveLunaCall(250000, 40000, 0);
    expect(reserve).toBe(90000);
    expect(reserveLunaCall(250000, 40000, 1910000)).toBe(90000);
    expect(() => reserveLunaCall(250000, 40000, 1910001)).toThrow(/BUDGET_EXHAUSTED/);
    expect(() => reserveLunaCall(250000, 40000, 2000000)).toThrow();
    for (const value of [-1, NaN, Infinity, 1.5]) expect(() => reserveLunaCall(value, 40000, 0)).toThrow();
  });
  it("prices cached and long-context usage, retaining holds when usage is invalid", () => {
    expect(lunaActualMicros(100000, 10000, 50000)).toBe(10500);
    expect(lunaActualMicros(300000, 10000, 100000)).toBe(49500);
    expect(lunaActualMicros(-1, 100, 0)).toBeNull();
    expect(lunaActualMicros(100, 100, 101)).toBeNull();
    expect(lunaActualMicros(100, NaN, 0)).toBeNull();
    expect(reserveLunaCall(950000, 64000, 0)).toBeGreaterThan(lunaActualMicros(950000, 64000, 0)!);
  });
});
