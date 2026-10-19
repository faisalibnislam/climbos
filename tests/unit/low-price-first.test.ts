import { describe, expect, it } from "vitest";
import { lintAnyPaidPlan, lintLowPriceFirst } from "../../shared/agents/specs";

/** Bench Run 7: low-price products start on an existing page with a free route; success counts any paid plan. */
const evidence = "Research notes: https://meetrao.com/compare/calendly is the existing comparison page. https://meetrao.com/pricing lists $30/year.";
const cheap = { revenuePerCustomerMonthUsd: 2.5 };

describe("lintLowPriceFirst", () => {
  it("passes a first play that improves an existing page with a free creator route, paid ads gated on its result", () => {
    const plays = [
      { name: "Comparison page", assetUsed: "https://meetrao.com/compare/calendly", firstActionToday: "Update https://meetrao.com/compare/calendly with a pricing table", route: "Creators: pitch 10 productivity YouTubers, 50 visits a week (assumption), free, 2 owner hours", model: { monthlySpendUsd: 0 } },
      { name: "Search ads", assetUsed: "https://meetrao.com/compare/calendly", firstActionToday: "Draft 3 ads", test: "Run search ads only once the page converts ≥2% from creator visits", model: { monthlySpendUsd: 100 } },
    ];
    expect(lintLowPriceFirst(plays, cheap, evidence)).toEqual([]);
  });

  it("flags a first play that buys traffic or builds new pages, and ungated spend later", () => {
    const plays = [
      { name: "New pages + ads", assetUsed: "To build: 4 comparison pages", firstActionToday: "Write 4 new comparison pages", route: "Google search ads, $250 a month, 100 visits a week (planned), 2 hours", model: { monthlySpendUsd: 250 } },
      { name: "Retargeting", assetUsed: "https://meetrao.com/pricing", firstActionToday: "Set up retargeting", test: "Retarget pricing visitors for 30 days", model: { monthlySpendUsd: 80 } },
    ];
    const issues = lintLowPriceFirst(plays, cheap, evidence);
    expect(issues.map((i) => i.path)).toEqual(["plays[0].assetUsed", "plays[0].route", "plays[1].test"]);
    expect(issues.every((i) => i.rule === "low_price_first")).toBe(true);
  });

  it("doesn't apply above the low-price line", () => {
    const plays = [{ name: "Ads", assetUsed: "To build: landing page", firstActionToday: "Build it", route: "Search ads $500", model: { monthlySpendUsd: 500 } }];
    expect(lintLowPriceFirst(plays, { revenuePerCustomerMonthUsd: 99 }, evidence)).toEqual([]);
  });
});

describe("lintAnyPaidPlan", () => {
  it("flags success counted on one tier and accepts any paid plan", () => {
    expect(lintAnyPaidPlan([{ text: "new Pro plan customers", path: "plays[0].unit" }]).map((i) => i.rule)).toEqual(["any_paid_plan"]);
    expect(lintAnyPaidPlan([{ text: "new paying customers on any paid plan", path: "northStar.metric" }])).toEqual([]);
    expect(lintAnyPaidPlan([{ text: "new paid accounts", path: "plays[0].unit" }])).toEqual([]);
  });
});
