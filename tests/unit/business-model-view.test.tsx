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
    expect(html).toContain("Result observed · Outcome not recorded · Keep testing");
    expect(html).toContain("2 of 5 asked how to start");
  });

  it("shows changed-input review guidance without hiding the bold alternative or starting work", () => {
    const html = renderToStaticMarkup(createElement(BusinessModelCheckView, { check, createdAt: 0, tests: {}, canEdit: false, freshness: { status: "changed", changed: ["business", "billing"], capturedAt: 1, checkedAt: 2, reason: "Inputs changed since this check." } }));
    expect(html).toContain("Review this saved judgment");
    expect(html).toContain("Business model described in this report");
    expect(html).toContain("Saved assessment");
    expect(html).not.toContain("How the business makes money today");
    expect(html).toContain("Business details and economics, Imported billing records");
    expect(html).toContain("Bold · may have no precedent");
    expect(html).toContain("owner-started");
    expect(html).not.toContain("Save test result");
  });

  it("shows original report facts without linking to a different plan's sources", () => {
    const cited = demoBusinessModelCheck("Source check");
    cited.currentModel.evidenceRefs = ["fact:0", "fact:1"];
    cited.alternatives[0].unitEconomicsInputs = [{ input: "Reported price", value: "$49", basis: "owner_report", evidenceRefs: ["fact:0"] }];
    const html = renderToStaticMarkup(createElement(BusinessModelCheckView, { check: cited, createdAt: 0, tests: {}, canEdit: false, facts: [{ statement: "Original owner price was $49.", basis: "owner_reported" }] }));
    expect(html).toContain("Original owner price was $49.");
    expect(html).toContain("Business fact 1 · owner-reported");
    expect(html).toContain("Business fact 2 · original text unavailable");
    expect(html).not.toContain('href="#sources-heading"');
    const legacy = renderToStaticMarkup(createElement(BusinessModelCheckView, { check: cited, createdAt: 0, tests: {}, canEdit: false }));
    expect(legacy).toContain("Current business facts may differ");
    expect(legacy).not.toContain('href="#sources-heading"');
  });

  it("is listed under Your plan in the tool directory", () => {
    expect(APP_TOOLS.find((tool) => tool.key === "business-model")).toMatchObject({ area: "plan", label: "Business model check" });
  });
});
