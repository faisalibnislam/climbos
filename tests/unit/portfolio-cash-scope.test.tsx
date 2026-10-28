import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortfolioObjectiveCard } from "../../src/components/app/plan/ExpertPlan";
import type { PortfolioChoice } from "../../shared/agents/economics";

describe("growth portfolio cash-feasibility boundary", () => {
  it("does not imply the monthly growth-cash limit forecasts cash flow or bank balance", () => {
    const choice: PortfolioChoice = {
      objective: "combined_current",
      selected: ["Customer interview follow-up"],
      outcomeBasis: "attributed_only",
      customers: 4,
      spendUsdMonth: 0,
      cashSpendUsdMonth: 20,
      ownerHoursWeek: 2,
      expectedCustomers: 4,
      netUsd: 80,
      allFit: true,
      left: [],
      runnerUp: null,
      basis: "Owner-provided monthly limit.",
    };
    const html = renderToStaticMarkup(createElement(PortfolioObjectiveCard, {
      label: "Growth set",
      explanation: "Modeled alternatives.",
      choice,
      noChoice: "No feasible set.",
      days: 90,
    }));

    expect(html).toContain("Checks monthly growth costs against your limit");
    expect(html).toContain("does not forecast your bank balance");
    expect(html).toContain("timing of customer payments, refunds, taxes, or existing bills");
  });
});
