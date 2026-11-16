import { describe, expect, it } from "vitest";
import { minorToDisplay, microsToUsdCost, microsToCreditsLabel } from "../../src/components/app/money";
import { formatMetric } from "../../src/components/app/results/format";

describe("currency-specific stored money display", () => {
  it.each([
    [1200, "JPY", "¥1,200"],
    [12345, "KWD", "KWD 12.345"],
    [12345, "BHD", "BHD 12.345"],
    [12345, "CLF", "CLF 1.2345"],
    [1234, "USD", "$12.34"],
    [100001, "USD", "$1,000.01"],
    [1000001, "KWD", "KWD 1,000.001"],
    [-1, "KWD", "-KWD 0.001"],
    [0, "JPY", "¥0"],
    [0, "KWD", "KWD 0.000"],
    [-1200, "JPY", "-¥1,200"],
    [Number.MAX_SAFE_INTEGER, "USD", "$90,071,992,547,409.91"],
  ])("displays %s minor units of %s without changing their value", (minor, currency, expected) => {
    expect(minorToDisplay(minor, currency).replaceAll("\u00a0", " ")).toBe(expected);
    expect(formatMetric(minor, "currency_minor", currency).replaceAll("\u00a0", " ")).toBe(expected);
  });

  it.each([undefined, null, "", "US", "12$", "ZZZ"])("keeps missing or unsupported currency unknown: %s", currency => {
    expect(minorToDisplay(1234, currency)).toBe("Unknown");
    expect(formatMetric(1234, "currency_minor", currency)).toBe("Unknown");
  });

  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, 1.5])("does not show invalid stored money as a price: %s", amount => {
    expect(minorToDisplay(amount, "USD")).toBe("Unknown");
  });

  it("leaves USD provider-cost and credit units separate from customer currency", () => {
    expect(microsToUsdCost(1_230_000)).toBe("$1.23");
    expect(microsToCreditsLabel(1_230_000)).toContain("123");
    expect(formatMetric(1234, "count", null)).toBe("1,234");
  });
});
