import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Sources, type PlanView } from "@/components/app/plan/PlanSections";

describe("plan fact source details", () => {
  it("labels the evidence basis and explains the limits of an expired page excerpt", () => {
    const facts = [{
      id: "fact-1",
      statement: "The Pro plan costs $20 per month.",
      category: "pricing",
      provenance: "researched",
      reviewState: "confirmed",
      confidence: "high",
      verifiedAt: Date.UTC(2026, 9, 20),
      sourceDetailsUnavailableCount: 0,
      additionalSourceCount: 0,
      sources: [{
        id: "source-1",
        kind: "website",
        url: "https://example.com/pricing",
        title: "Pricing page",
        excerpt: null,
        excerptExpired: true,
        fetchedAt: Date.UTC(2026, 9, 19),
        status: "ok",
      }],
    }] as unknown as PlanView["sources"];
    const markup = renderToStaticMarkup(createElement(Sources, { sources: facts }));

    expect(markup).toContain("From research");
    expect(markup).toContain("Confirmed");
    expect(markup).toContain("last checked 2026-10-20");
    expect(markup).toContain("Read 2026-10-19");
    expect(markup).toContain("The saved page excerpt is no longer retained");
    expect(markup).toContain("https://example.com/pricing");
  });
});
