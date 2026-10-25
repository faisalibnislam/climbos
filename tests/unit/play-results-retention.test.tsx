import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RetentionResultsSummary } from "../../src/components/app/plan/PlayResults";
import type { RetentionActuals } from "../../shared/growth/actuals";

describe("owner-entered retention results presentation", () => {
  it("shows currency, reported-week coverage, and the association limit", () => {
    const retention: RetentionActuals = {
      weeksReported: 2,
      repeatCustomerWeeksReported: 1,
      repeatCustomerWeeks: 3,
      revenueByCurrency: [{ currency: "USD", netRevenueMinor: 50_000, weeksReported: 1 }],
      contributionByCurrency: [{ currency: "USD", contributionMinor: 32_000, weeksReported: 1 }],
      limitations: [],
    };
    const html = renderToStaticMarkup(createElement(RetentionResultsSummary, { retention }));

    expect(html).toContain("Existing-customer results · owner reported");
    expect(html).toContain("3 customer-weeks across 1 reported week");
    expect(html).toContain("$500");
    expect(html).toContain("$320");
    expect(html).toContain("do not prove it caused the change");
  });

  it("keeps repeat-customer counts unknown when only money was reported", () => {
    const retention: RetentionActuals = {
      weeksReported: 1,
      repeatCustomerWeeksReported: 0,
      repeatCustomerWeeks: 0,
      revenueByCurrency: [{ currency: "BDT", netRevenueMinor: 12_500, weeksReported: 1 }],
      contributionByCurrency: [],
      limitations: [],
    };
    const html = renderToStaticMarkup(createElement(RetentionResultsSummary, { retention }));

    expect(html).toContain("Repeat customers: Not reported");
    expect(html).toContain("৳125");
    expect(html).toContain("Retained contribution: Not reported");
  });

  it("labels an empty retention record without showing zero as a measured result", () => {
    const html = renderToStaticMarkup(createElement(RetentionResultsSummary, { retention: undefined }));
    expect(html).toContain("No repeat-customer outcomes recorded yet.");
    expect(html).not.toContain(">0<");
  });
});
