import { describe, expect, it } from "vitest";
import { maxRolling31DaySpend, validCampaignDateRange } from "../../shared/policy/campaignBudget";

const reservation = (overrides: Partial<Parameters<typeof maxRolling31DaySpend>[0][number]> = {}) => ({
  status: "active",
  currency: "USD",
  dailyBudgetMinor: 1_500,
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  ...overrides,
});

describe("cross-platform campaign budget reservations", () => {
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
