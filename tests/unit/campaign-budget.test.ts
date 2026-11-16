import { describe, expect, it } from "vitest";
import { AD_BUDGET_UNIT_VERSION, campaignBudgetProblem, knownAdBudget, parseAdBudget, maxRolling31DaySpend, validCampaignDateRange } from "../../shared/policy/campaignBudget";

const reservation = (overrides: Partial<Parameters<typeof maxRolling31DaySpend>[0][number]> = {}) => ({
  status: "active",
  currency: "USD",
  dailyBudgetMinor: 1_500,
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  ...overrides,
});

describe("cross-platform campaign budget reservations", () => {
  it.each([["JPY", "1200", 1200], ["USD", "12.34", 1234], ["KWD", "12.345", 12345], ["CLF", "1.2345", 12345]])("parses exact %s units", (currency, text, minor) => {
    expect(parseAdBudget(text, currency)).toEqual({ ok: true, minor });
  });
  it.each([["JPY", "1.1"], ["KWD", "1.2345"], ["USD", "-1"], ["USD", "Infinity"], ["USD", "9007199254740992"], ["ZZZ", "12"]])("rejects unsupported %s amount %s", (currency, text) => {
    expect(parseAdBudget(text, currency).ok).toBe(false);
  });
  it("distinguishes confirmed, legacy and zero amounts without rewriting them", () => {
    expect(knownAdBudget(12345, "KWD")).toBe(false);
    expect(knownAdBudget(12345, "KWD", AD_BUDGET_UNIT_VERSION)).toBe(true);
    expect(knownAdBudget(12345, "USD")).toBe(true);
    expect(knownAdBudget(0, "JPY")).toBe(true);
    expect(knownAdBudget(12345, "USD", "unknown-version")).toBe(false);
    expect(knownAdBudget(12.3, "USD", AD_BUDGET_UNIT_VERSION)).toBe(false);
    expect(knownAdBudget(0, "ZZZ")).toBe(false);
  });
  it("rejects ambiguous reservations and inconsistent planned totals", () => {
    const old = reservation({ currency: "KWD" });
    expect(maxRolling31DaySpend([old], "KWD", "2026-10-24")).toMatchObject({ ok: false, reason: "unknown_reservation" });
    const confirmed = { ...old, budgetUnitVersion: AD_BUDGET_UNIT_VERSION, budgetEnvelopeMinor: 45000 };
    expect(maxRolling31DaySpend([confirmed], "KWD", "2026-10-24")).toMatchObject({ ok: true, maxSpendMinor: 45000 });
    expect(campaignBudgetProblem(confirmed)).toBeNull();
    expect(campaignBudgetProblem({ ...confirmed, budgetEnvelopeMinor: 45001 })).toMatch(/do not agree/);
  });
  it("sums overlapping Google and Meta caps in the highest rolling 31-day window", () => {
    const result = maxRolling31DaySpend(
      [reservation(), reservation({ status: "needs_approval", dailyBudgetMinor: 600 })],
      "USD",
      "2026-10-24",
    );

    expect(result).toEqual({ ok: true, maxSpendMinor: 63_000, windowStart: "2026-11-01" });
  });

  it("does not add campaigns whose schedules fall outside the same 31-day window", () => {
    const result = maxRolling31DaySpend(
      [reservation(), reservation({ startDate: "2026-12-01", endDate: "2026-12-30" })],
      "USD",
      "2026-10-24",
    );

    // A 31-day inclusive window can contain Dec 1 as well as Nov 1–30.
    expect(result).toEqual({ ok: true, maxSpendMinor: 46_500, windowStart: "2026-11-01" });
  });

  it("fails closed on unknown schedules or currencies", () => {
    expect(maxRolling31DaySpend([reservation({ startDate: undefined })], "USD", "2026-10-24")).toEqual({ ok: false, reason: "unknown_reservation" });
    expect(maxRolling31DaySpend([reservation({ currency: "EUR" })], "USD", "2026-10-24")).toEqual({ ok: false, reason: "currency_mismatch" });
    expect(maxRolling31DaySpend([reservation({ dailyBudgetMinor: Number.MAX_SAFE_INTEGER })], "USD", "2026-10-24")).toEqual({ ok: false, reason: "unknown_reservation" });
  });

  it("ignores ended commitments and validates real calendar dates", () => {
    expect(maxRolling31DaySpend([reservation({ status: "ended" })], "USD", "2026-10-24")).toMatchObject({ ok: true, maxSpendMinor: 0 });
    expect(validCampaignDateRange("2026-02-29", "2026-03-01")).toBe(false);
    expect(validCampaignDateRange("2028-02-29", "2028-03-01")).toBe(true);
    expect(validCampaignDateRange("2026-11-02", "2026-11-01")).toBe(false);
  });
});
