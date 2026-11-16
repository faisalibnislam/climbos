import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { costCheck } from "../../shared/growth/actuals";
import { CostPerCustomerLine } from "../../src/components/app/plan/PlayResults";

describe("logged cost per customer", () => {
  it("divides logged cash spend by logged customers and compares it with what a customer is worth", () => {
    expect(costCheck({ spendUsd: 300, customers: 6 }, 80)).toEqual({ cashCostPerCustomerUsd: 50, affordableUsd: 80, status: "within" });
    expect(costCheck({ spendUsd: 300, customers: 3 }, 80)).toEqual({ cashCostPerCustomerUsd: 100, affordableUsd: 80, status: "above" });
    expect(costCheck({ spendUsd: 300, customers: 0 }, 80).status).toBe("no_customers");
    expect(costCheck({ spendUsd: 0, customers: 4 }, 80).status).toBe("no_spend");
    expect(costCheck({ spendUsd: 300, customers: 6 }, null)).toEqual({ cashCostPerCustomerUsd: 50, affordableUsd: null, status: "value_unknown" });
  });

  it("shows the computed cost, the comparison, and that owner time is excluded", () => {
    const html = renderToStaticMarkup(createElement(CostPerCustomerLine, { check: costCheck({ spendUsd: 300, customers: 3 }, 80), currency: "USD" }));
    expect(html).toContain("Cash cost per customer: $100");
    expect(html).toContain("a customer is worth $80.00 within the payback window");
    expect(html).toContain("your time isn&#x27;t included");
    expect(renderToStaticMarkup(createElement(CostPerCustomerLine, { check: costCheck({ spendUsd: 300, customers: 6 }, null), currency: "USD" }))).toContain("unknown until price, margin and churn are known");
    expect(renderToStaticMarkup(createElement(CostPerCustomerLine, { check: costCheck({ spendUsd: 0, customers: 6 }, 80) }))).toBe("");
  });
  it("shows unknown spend without fabricating a cost and preserves three-decimal comparison amounts", () => {
    const unknown = renderToStaticMarkup(createElement(CostPerCustomerLine, { check: costCheck({ spendUsd: null, customers: 3 }, 80), currency: "USD" }));
    expect(unknown).toContain("unavailable until the original spending and currency are confirmed");
    expect(unknown).not.toContain("$0");
    const precise = renderToStaticMarkup(createElement(CostPerCustomerLine, { check: costCheck({ spendUsd: 12.345, customers: 1 }, 19.876), currency: "KWD" }));
    expect(precise).toContain("12.345"); expect(precise).toContain("19.876");
  });
});
