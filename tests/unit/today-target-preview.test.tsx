import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TodayTargetPreviewCard } from "../../src/components/app/today/TodayTargetPreview";
import type { TodayTargetPreview } from "../../convex/targets";

const preview: TodayTargetPreview = {
  campaignId: "campaign-1" as TodayTargetPreview["campaignId"],
  playId: "creator-play",
  playName: "A sample plan step",
  kind: "creators",
  status: "review",
  matches: [
    { id: "target-1" as TodayTargetPreview["matches"][number]["id"], name: "Sample Creator" },
    { id: "target-2" as TodayTargetPreview["matches"][number]["id"], name: "Another Creator" },
  ],
  hasMore: true,
};

describe("Home plan target preview", () => {
  it("labels creator suggestions as possible partners and links to full plan evidence", () => {
    const html = renderToStaticMarkup(createElement(TodayTargetPreviewCard, { slug: "flow-studio", preview }));
    expect(html).toContain("Possible creator partners");
    expect(html).toContain("Ready to review");
    expect(html).toContain("Sample Creator");
    expect(html).toContain("More creator profiles are listed in your plan.");
    expect(html).toContain("not confirmed partners");
    expect(html).toContain("Nothing is sent from Home.");
    expect(html).toContain("/app/flow-studio/plan#plays");
  });

  it("keeps business target suggestions labeled as possible customers", () => {
    const html = renderToStaticMarkup(createElement(TodayTargetPreviewCard, {
      slug: "flow-studio", preview: { ...preview, kind: "customers", playId: "customer-play", matches: [{ id: "target-1" as TodayTargetPreview["matches"][number]["id"], name: "Sample Company" }], hasMore: false },
    }));
    expect(html).toContain("Possible customers");
    expect(html).toContain("not confirmed customers");
    expect(html).not.toContain("creator partners");
  });

  it("keeps progress useful when research is still running and hides absent previews", () => {
    const researching = renderToStaticMarkup(createElement(TodayTargetPreviewCard, {
      slug: "flow-studio", preview: { ...preview, status: "researching", matches: [], hasMore: false },
    }));
    expect(researching).toContain("In progress");
    expect(researching).toContain("looking for possible matches");
    expect(researching).not.toContain("Sample Creator");
    expect(renderToStaticMarkup(createElement(TodayTargetPreviewCard, { slug: "flow-studio", preview: null }))).toBe("");
  });
});
