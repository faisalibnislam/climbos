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

  it("keeps saved research detail behind an accessible disclosure and labels its limits", () => {
    const retrievedAt = Date.UTC(2026, 9, 25);
    const html = renderToStaticMarkup(createElement(Sources, {
      sources: [],
      researchEvidence: [{ agentId: "growth_plays", notes: "Source says the feature launched in 2025.", sources: [{ url: "https://example.com/news", title: "Launch note", pageReportedDates: [{ kind: "published", date: "2025-02-03", source: "json_ld" }] }], retrievedAt, truncated: false }],
    }));

    expect(html).toContain("<details");
    expect(html).toContain("Research notes and assessment");
    expect(html).toContain("Retrieved 2026-10-25");
    expect(html).toContain("written by AI from the listed sources");
    expect(html).toContain("source relevance and reliability are not independently verified");
    expect(html).toContain("https://example.com/news");
    expect(html).toContain("Page-reported published: 2025-02-03");
    expect(html).toContain("page metadata, not independently verified");
  });
});
