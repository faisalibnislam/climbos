import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OwnerGoalTarget } from "../../src/components/app/today/OwnerGoalTarget";

describe("owner goal target summary", () => {
  it("shows an incremental customer target and makes its owner-entered basis clear", () => {
    const html = renderToStaticMarkup(createElement(OwnerGoalTarget, {
      target: { metric: "customers", baseline: 12, desired: 30, mode: "incremental" },
      currency: "USD",
      horizonDays: 90,
    }));

    expect(html).toContain("Your target · 90 days");
    expect(html).toContain("30 new customers");
    expect(html).toContain("Starting point in your goal: 12 customers.");
    expect(html).toContain("not a measured result");
  });

  it("formats monthly revenue using the goal currency and leaves an absent baseline unknown", () => {
    const html = renderToStaticMarkup(createElement(OwnerGoalTarget, {
      target: { metric: "revenue_month", baseline: null, desired: 2500, mode: "total" },
      currency: "USD",
      horizonDays: 60,
    }));

    expect(html).toContain("$2,500 monthly revenue");
    expect(html).toContain("Starting point not entered.");
  });

  it("does not invent a unit for an unspecified target or render a target without a number", () => {
    const unspecified = renderToStaticMarkup(createElement(OwnerGoalTarget, {
      target: { metric: "other", baseline: null, desired: 4, mode: "incremental" },
      currency: "USD",
      horizonDays: 30,
    }));
    const missing = renderToStaticMarkup(createElement(OwnerGoalTarget, {
      target: { metric: "customers", baseline: null, desired: null, mode: "total" },
      currency: "USD",
      horizonDays: 30,
    }));

    expect(unspecified).toContain("Additional target: 4 (measure not specified)");
    expect(missing).toBe("");
  });
});
