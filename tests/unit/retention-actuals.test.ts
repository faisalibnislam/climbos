import { describe, expect, it } from "vitest";
import { retentionActuals } from "../../shared/growth/actuals";

describe("repeat-customer outcome summaries", () => {
  it("sums reported weekly outcomes by currency and keeps missing weeks explicit", () => {
    const result = retentionActuals([
      { repeatCustomers: 2, retainedRevenueMinor: 10_000, retainedContributionMinor: 4_000, retentionCurrency: "USD" },
      { repeatCustomers: 3, retainedRevenueMinor: 8_000, retainedContributionMinor: -500, retentionCurrency: "USD" },
      { repeatCustomers: 1, retainedRevenueMinor: 90_000, retainedContributionMinor: 20_000, retentionCurrency: "EUR" },
      { repeatCustomers: 0 },
      {},
    ]);
    expect(result).toEqual({
      weeksReported: 4,
      repeatCustomerWeeksReported: 4,
      repeatCustomerWeeks: 6,
      revenueByCurrency: [
        { currency: "EUR", netRevenueMinor: 90_000, weeksReported: 1 },
        { currency: "USD", netRevenueMinor: 18_000, weeksReported: 2 },
      ],
      contributionByCurrency: [
        { currency: "EUR", contributionMinor: 20_000, weeksReported: 1 },
        { currency: "USD", contributionMinor: 3_500, weeksReported: 2 },
      ],
      limitations: [
        "Owner-reported play association is not proof of attribution or incremental impact.",
        "Repeat customer totals are customer-weeks; a person can be counted again in a later week.",
        "Only weeks with reported amounts are included; missing weeks are unknown.",
      ],
    });
  });

  it("does not report repeat-customer counts from weeks that only contain money", () => {
    const result = retentionActuals([
      { retainedRevenueMinor: 1_200, retentionCurrency: "USD" },
      { repeatCustomers: 0 },
    ]);
    expect(result).toMatchObject({ weeksReported: 2, repeatCustomerWeeksReported: 1, repeatCustomerWeeks: 0 });
  });
});
