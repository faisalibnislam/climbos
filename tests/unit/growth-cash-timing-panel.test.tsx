import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()) }));

import { GrowthCashTimingPanel, type GrowthCashTimingView } from "../../src/components/app/plan/GrowthCashTiming";

const base: GrowthCashTimingView = {
  horizonWeeks: 4,
  weeklyCashOutUsd: 300,
  cashOutOverPeriodUsd: 1_200,
  reserveUsd: 100,
  paymentLagDays: 14,
  mostLikely: { customers: 40, lowestBalanceUsd: -750, lowestWeek: 3, endBalanceUsd: -750, recoveredWeek: null, reserveCovers: false, shortfallUsd: 650 },
  lowCase: { customers: 8, lowestBalanceUsd: -1_100, lowestWeek: 4, endBalanceUsd: -1_100, recoveredWeek: null, reserveCovers: false, shortfallUsd: 1_000 },
  missing: [],
  unconfirmedEconomics: ["churn"],
  selected: ["Partner referrals"],
  currency: "USD",
  reserveCurrencyMismatch: false,
  ownerInputsUpdatedAt: 1,
};
const render = (data: GrowthCashTimingView, canEdit = true) => renderToStaticMarkup(createElement(GrowthCashTimingPanel, { data, slug: "acme", canEdit }));

describe("growth cash timing panel", () => {
  it("labels owner inputs, both scenarios, the reserve gap, and the forecast boundary", () => {
    const html = render(base);
    expect(html).toContain("$100 · you reported");
    expect(html).toContain("14 days · you reported");
    expect(html).toContain("Lowest point -$750 in week 3");
    expect(html).toContain("If customers come in at the low end (P10)");
    expect(html).toContain("short by $650");
    expect(html).toContain("Uses churn you haven&#x27;t confirmed");
    expect(html).toContain("not a bank balance or cash-flow forecast");
    expect(html).toContain("Cash set aside for growth (USD)");
  });

  it("shows unknown inputs as unknown and does not time customer payments", () => {
    const html = render({ ...base, reserveUsd: null, paymentLagDays: null, mostLikely: null, lowCase: null, missing: ["payment_lag", "reserve"], ownerInputsUpdatedAt: null }, false);
    expect(html.match(/Unknown · not assumed/g)).toHaveLength(2);
    expect(html).toContain("Customer payments aren&#x27;t timed yet");
    expect(html).toContain("how many days a new customer takes to pay");
    expect(html).not.toContain("the cash you have set aside");
    expect(html).not.toContain("Lowest point");
    expect(html).not.toContain("Cash set aside for growth (USD)");
  });

  it("asks for a reserve saved in another currency to be re-entered", () => {
    const html = render({ ...base, reserveUsd: null, reserveCurrencyMismatch: true });
    expect(html).toContain("Saved reserve is in another currency");
    expect(html).toContain("Enter it again in USD");
  });
});
