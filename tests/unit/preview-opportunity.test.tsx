import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewOpportunity } from "../../src/components/marketing/PreviewOpportunity";

describe("first homepage opportunity preview", () => {
  it("shows the exact evidence, next step, preliminary status, and source link together", () => {
    const markup = renderToStaticMarkup(createElement(PreviewOpportunity, {
      finding: {
        observation: "The page explains the process before the customer outcome.",
        evidenceQuote: "We guide you through each step of our process.",
        whyItMayMatter: "Visitors may need the result before the process details.",
        firstStep: "Ask one recent customer what they expected to achieve.",
        sourceUrl: "https://example.com/",
      },
    }));
    expect(markup).toContain("Possible opportunity to check");
    expect(markup).toContain("Preliminary");
    expect(markup).toContain("We guide you through each step of our process.");
    expect(markup).toContain('href="https://example.com/"');
    expect(markup).toContain("Why it may matter:");
    expect(markup).toContain("A small first step:");
    expect(markup).toContain("not a confirmed business problem");
  });
});
