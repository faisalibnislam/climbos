import { describe, expect, it } from "vitest";
import { seoToArtifacts } from "../../convex/jobWrites";
import type { SeoBriefOutput } from "../../shared/ai/tasks";

describe("SEO answer-first artifact export", () => {
  it("keeps the direct answer, FAQs, sourced claims, and their fact references in the saved draft", () => {
    const output: SeoBriefOutput = {
      title: "How to prepare an intake form",
      metaDescription: "A short guide to intake forms.",
      primaryKeyword: "client intake form",
      secondaryKeywords: ["service intake"],
      searchIntent: "how to create a client intake form",
      outline: [{ heading: "Start with the next step", points: ["Ask only what is needed"] }],
      internalLinks: ["/templates"],
      draft: "Keep the process short and explain what happens after submission.",
      answerFirst: "A good intake form collects only the information needed for the next service step.",
      faqs: [{ question: "What should it ask?", answer: "Ask for details needed to deliver the service.", factIndexes: [0], sourceUrls: ["https://example.com/intake-guide"] }],
      originalContribution: "Explain the service's actual intake process and when a client gets a response.",
      ownerEvidenceNeeded: ["Confirm the actual response-time promise with the business owner."],
      measurementPlan: "Compare page clicks and qualified inquiries after publication with the pre-publication baseline, if tracking is connected.",
      citableClaims: [{ statement: "The service uses a monthly plan.", factIndexes: [1], sourceUrls: [] }],
      factIndexes: [0],
      recommendedAction: "refresh_existing_page",
      targetPageUrl: "https://example.com/intake-guide",
      recommendationReason: "The observed page already serves this customer task.",
    };
    const [artifact] = seoToArtifacts(output);
    expect(artifact.body.indexOf("## Quick answer")).toBeLessThan(artifact.body.indexOf("## Start with the next step"));
    expect(artifact.body).toContain("## Frequently asked questions");
    expect(artifact.body).toContain("[Source](https://example.com/intake-guide)");
    expect(artifact.body).toContain("## Verified facts");
    expect(artifact.body).toContain("## Original contribution");
    expect(artifact.body).toContain("Confirm the actual response-time promise");
    expect(artifact.body).toContain("## Measurement plan");
    expect(artifact.body).toContain("## Recommended action: refresh existing page");
    expect(artifact.body).toContain("https://example.com/intake-guide");
    expect(artifact.destinationUrl).toBe("https://example.com/intake-guide");
    expect(artifact.factIndexes).toEqual([0, 1]);
  });
});
