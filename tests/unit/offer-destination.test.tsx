import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { approvedPricesOnPage, offerDestinationStatus } from "../../shared/integrations/offerDestination";

vi.mock("convex/react", () => ({ useAction: vi.fn(() => vi.fn()) }));
const { OfferDestinationNotice } = await import("../../src/components/app/content/detail/OfferDestinationCheck");

describe("offer still shown at the link destination", () => {
  it("matches approved prices as standalone numbers or JSON-LD offers, not as parts of other numbers", () => {
    expect(approvedPricesOnPage({ text: "Starter plan $29 per month" }, [29])).toEqual([29]);
    expect(approvedPricesOnPage({ text: "Starter plan £29.00 / month" }, [29])).toEqual([29]);
    expect(approvedPricesOnPage({ text: "Starter 29,00 € pro Monat" }, [29])).toEqual([29]);
    expect(approvedPricesOnPage({ text: "Starter plan $129 or $29.50" }, [29])).toEqual([]);
    expect(approvedPricesOnPage({ text: "See pricing", jsonLdPrices: [{ price: "29.00" }] }, [29])).toEqual([29]);
    expect(approvedPricesOnPage({ text: "Only $49 now" }, [29, 49])).toEqual([49]);
  });

  it("reports found, not found, or unavailable", () => {
    expect(offerDestinationStatus({ text: "$29" }, [29])).toEqual({ status: "found", found: [29] });
    expect(offerDestinationStatus({ text: "$39" }, [29])).toEqual({ status: "not_found", found: [] });
    expect(offerDestinationStatus(null, [29])).toEqual({ status: "unavailable", found: [] });
  });

  it("warns without blocking and explains what a miss can mean", () => {
    const html = renderToStaticMarkup(createElement(OfferDestinationNotice, { check: { checkedAt: Date.UTC(2026, 9, 1), url: "https://acme.example/pricing", status: "not_found", found: [] }, prices: [29], currency: "USD" }));
    expect(html).toContain("Approved price not found on the linked page");
    expect(html).toContain("$29.00");
    expect(html).toContain("may load in a way ClimbOS can&#x27;t read");
    expect(renderToStaticMarkup(createElement(OfferDestinationNotice, { check: { checkedAt: 1, url: "u", status: "found", found: [29] }, prices: [29], currency: "USD" }))).toContain("shows the approved price $29.00");
    expect(renderToStaticMarkup(createElement(OfferDestinationNotice, { check: null, prices: [29], currency: "USD" }))).toContain("hasn&#x27;t been checked");
  });
});
