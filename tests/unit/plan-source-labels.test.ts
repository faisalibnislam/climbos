import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Sources } from "../../src/components/app/plan/PlanSections";

describe("plan source relationship labels", () => {
  it("labels the exact business website as a published claim and does not call other domains independent", () => {
    const html = renderToStaticMarkup(createElement(Sources, {
      sources: [],
      websiteUrl: "https://www.example.com",
      web: [
        { url: "https://example.com/pricing", title: "Pricing" },
        { url: "https://review.example.net/company", title: "Review" },
      ],
    }));

    expect(html).toContain("Your website · published claim");
    expect(html).toContain("Other website · independence unverified");
    expect(html).toContain("a different website does not by itself make a source independent or prove its claims");
  });

  it("does not guess the relationship when no business website was saved", () => {
    const html = renderToStaticMarkup(createElement(Sources, {
      sources: [],
      web: [{ url: "https://reference.example.org/report" }],
    }));

    expect(html).toContain("Site relationship unknown · independence unverified");
    expect(html).not.toContain("Your website · published claim");
  });
});
