import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { metaConversions, reviewCampaignPerformance } from "../../shared/acquisition/campaignPerformance";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()), useAction: vi.fn(() => vi.fn()) }));
const { MetaConversionChoice } = await import("../../src/components/app/content/Campaigns");

const actions = [{ actionType: "lead", value: 6 }, { actionType: "link_click", value: 400 }];

describe("Meta conversion choice", () => {
  it("counts only the owner-confirmed action type", () => {
    expect(metaConversions(actions, "lead")).toBe(6);
    expect(metaConversions(actions, null)).toBeUndefined();
    expect(metaConversions(actions, "purchase")).toBeUndefined();
    // With the confirmed count, the existing target review applies (300.00 spent / 6 leads = 50.00 per lead).
    const review = reviewCampaignPerformance({ spendMinor: 30_000, conversions: metaConversions(actions, "lead")!, observedThrough: "2026-10-20", campaignStartDate: "2026-10-01", reviewAfterDays: 7, targetCostPerConversionMinor: 4_000 });
    expect(review.status).toBe("review");
  });

  it("asks the owner to choose, and says no count is used until then", () => {
    const html = renderToStaticMarkup(createElement(MetaConversionChoice, { slug: "acme", campaignId: "c1" as never, actions, chosen: null, canEdit: true }));
    expect(html).toContain("Choose which Meta action is the conversion");
    expect(html).toContain("counts only the one you confirm");
    const chosen = renderToStaticMarkup(createElement(MetaConversionChoice, { slug: "acme", campaignId: "c1" as never, actions, chosen: "lead", canEdit: false }));
    expect(chosen).toContain("Counting “lead” as the conversion");
    expect(renderToStaticMarkup(createElement(MetaConversionChoice, { slug: "acme", campaignId: "c1" as never, actions: [], chosen: null, canEdit: true }))).toContain("No action types reported yet");
  });
});
