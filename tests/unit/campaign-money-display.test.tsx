import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { mutation, action } = vi.hoisted(() => ({ mutation: vi.fn(), action: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: () => ({ userId: "owner", orgs: [{ slug: "test", role: "owner" }] }), useMutation: () => mutation, useAction: () => action }));
const { CampaignCard } = await import("../../src/components/app/content/Campaigns");
import type { Campaign } from "../../src/components/app/content/Campaigns";

describe("campaign amount presentation before approval", () => {
  beforeEach(() => { mutation.mockClear(); action.mockClear(); });
  it.each([["JPY", 1200, "¥1,200"], ["KWD", 12345, "KWD 12.345"]])("shows the stored %s budget accurately without requesting execution", (currency, amount, expected) => {
    const campaign = { id: "test", name: "Reviewed campaign", channel: "google_search_ad", status: "needs_approval", accountConnected: false, dailyBudgetMinor: amount, budgetEnvelopeMinor: amount * 2, currency, startDate: "2026-11-17", endDate: "2026-11-18", targetCostPerConversionMinor: amount, reviewAfterDays: 7, destinationUrl: "https://example.com", stopRules: [], externalId: null, performance: null } as unknown as Campaign;
    const html = renderToStaticMarkup(createElement(CampaignCard, { slug: "test", campaign })).replaceAll("\u00a0", " ");
    expect(html).toContain(expected);
    expect(html).toContain("Needs approval");
    expect(mutation).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });
});
