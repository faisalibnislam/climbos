import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AttributionSection, PlatformClaimsSection } from "../../src/components/app/results/AttributionSection";
import type { Overview } from "../../src/components/app/results/ResultsView";

const attribution = { model: "last_touch", reconciled: true, byCurrency: [{ currency: "USD", reconciled: true, totalNetBillingMinor: 3000, channels: [{ channel: "unmatched paid ads", netRevenueMinor: 3000, conversions: 3 }], unattributed: { netRevenueMinor: 0, conversions: 0 } }] };
const data = { currency: "USD", attribution: { lastTouch: attribution, firstTouch: attribution, issues: [], note: "Recorded paths, not cause." }, platformClaims: { platforms: [], adSpendMinor: 1000, adSpendByCurrency: { USD: 1000 }, warning: "Can overlap" }, platformClaimsNote: "The reporting scope has not been reconciled." } as unknown as Overview;

describe("attribution presentation", () => {
  it.each([["JPY", 1200, "¥1,200"], ["KWD", 12345, "KWD 12.345"], ["USD", 100001, "$1,000.01"]])("preserves %s amounts in the attribution and ad-spend tables", (currency, amount, expected) => {
    const attr = { ...attribution, byCurrency: [{ ...attribution.byCurrency[0], currency, totalNetBillingMinor: amount, channels: [{ channel: "search", netRevenueMinor: amount, conversions: 1 }] }] };
    const values = { ...data, currency, attribution: { ...data.attribution, lastTouch: attr, firstTouch: attr }, platformClaims: { ...data.platformClaims!, adSpendMinor: amount, adSpendByCurrency: { [currency]: amount } } } as Overview;
    for (const Component of [AttributionSection, PlatformClaimsSection]) {
      const html = renderToStaticMarkup(createElement(Component, { slug: "test", data: values })).replaceAll("\u00a0", " ");
      expect(html).toContain(expected);
    }
  });
  it("labels orders and renewals as payment events, not unique customers or verified billing", () => {
    const html = renderToStaticMarkup(createElement(AttributionSection, { slug: "test", data }));
    expect(html).toContain("Payment events");
    expect(html).toContain("not unique customers");
    expect(html).toContain("Rows reconcile");
    expect(html).not.toContain(">Customers</th>");
    expect(html).not.toContain("Matches billing");
  });
  it("shows evidence failures instead of suggesting no revenue exists", () => {
    const limited = { ...data, attribution: { ...data.attribution, lastTouch: null, firstTouch: null, issues: ["The touch history was truncated."] } };
    const html = renderToStaticMarkup(createElement(AttributionSection, { slug: "test", data: limited }));
    expect(html).toContain("Channel credit unavailable");
    expect(html).toContain("touch history was truncated");
    expect(html).not.toContain("No billing revenue yet");
  });
  it("does not divide unrelated ad-named revenue by platform spend", () => {
    const html = renderToStaticMarkup(createElement(PlatformClaimsSection, { slug: "test", data }));
    expect(html).toContain("Recorded ad spend");
    expect(html).toContain("Unknown");
    expect(html).toContain("matching channels, accounts, dates and definitions");
    expect(html).not.toContain("3.00×");
    expect(html).not.toContain("Revenue credited to ads");
  });
  it("keeps missing currency spend unknown instead of inventing zero spend", () => {
    const html = renderToStaticMarkup(createElement(PlatformClaimsSection, { slug: "test", data: { ...data, platformClaims: { ...data.platformClaims!, adSpendMinor: null } } }));
    expect(html).toContain("Missing spend is not zero");
    expect(html).not.toContain("No ad spend this period");
    expect(html).not.toContain("$0.00");
  });
});
