import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoBusinessModelCheck } from "../../shared/agents/businessModel";
import { BusinessModelCheckView } from "../../src/components/app/plan/BusinessModelCheckView";
import { APP_TOOLS } from "../../src/components/app/navigation";

describe("business model check view", () => {
  const check = { ...demoBusinessModelCheck("Acme"), verdict: { status: "at_risk" as const, confidence: "low" as const, reasoning: "Rivals moved to plans.", whatWouldChangeIt: "Flat repeat rate." } };

  it("labels the verdict as AI judgment and shows all three alternatives with their tests", () => {
    const html = renderToStaticMarkup(createElement(BusinessModelCheckView, { check, createdAt: Date.UTC(2026, 9, 25), isFixture: true, tests: {}, canEdit: true }));
    expect(html).toContain("Model at risk");
    expect(html).toContain("AI judgment · low confidence");
    expect(html).toContain("isn&#x27;t a verified finding");
    expect(html).toContain("Grounded · established practice");
    expect(html).toContain("Adjacent · evidence-supported stretch");
    expect(html).toContain("Bold · may have no precedent");
    expect(html).toContain("Smallest test:");
    expect(html).toContain("Price under the new model: unknown until tested");
    expect(html).toContain("Demo example");
    expect(html).toContain("Nothing here changes your prices, offers or operations");
    expect(html.match(/Save test result/g)).toHaveLength(4);
  });

  it("shows recorded tests read-only to viewers", () => {
    const html = renderToStaticMarkup(createElement(BusinessModelCheckView, {
      check, createdAt: 0, tests: { bold: { testState: "observed", outcomeNote: "2 of 5 asked how to start", outcomeEvidence: "owner_reported", ownerDecision: "keep_testing", createdAt: 1 } }, canEdit: false,
    }));
    expect(html).not.toContain("Save test result");
    expect(html).toContain("Result observed · Keep testing");
    expect(html).toContain("2 of 5 asked how to start");
  });

  it("is listed under Your plan in the tool directory", () => {
    expect(APP_TOOLS.find((tool) => tool.key === "business-model")).toMatchObject({ area: "plan", label: "Business model check" });
  });
});
