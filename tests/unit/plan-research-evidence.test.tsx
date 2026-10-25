import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Sources, type PlanView } from "../../src/components/app/plan/PlanSections";

describe("plan research evidence notice", () => {
  it("explains that run-level links do not verify each AI-written sentence", () => {
    const html = renderToStaticMarkup(createElement(Sources, {
      sources: [] as PlanView["sources"],
      researchEvidence: [{
        agentId: "growth_strategy",
        notes: "An AI-written research summary.",
        sources: [{ url: "https://example.com/source", title: "Example source" }],
        retrievedAt: Date.parse("2026-10-25T00:00:00Z"),
        truncated: false,
      }],
    }));

    expect(html).toContain("The links are for this research run");
    expect(html).toContain("they are not connected to each sentence");
    expect(html).toContain("not independently verified");
    expect(html).toContain("Open the source and check important claims");
  });
});
