import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionFocus } from "../../src/components/app/plan/DecisionFocus";

describe("DecisionFocus", () => {
  it("shows the saved primary play as the first step", () => {
    const html = renderToStaticMarkup(createElement(DecisionFocus, {
      focus: { primaryPlay: "Improve the first-session setup", supportingMove: "Interview new signups", maintenanceWork: "Review activation each week" },
    }));

    expect(html).toContain("Start with:");
    expect(html).toContain("Improve the first-session setup");
    expect(html).not.toContain("Interview new signups");
  });

  it("shows supporting and recurring work in the details view", () => {
    const html = renderToStaticMarkup(createElement(DecisionFocus, {
      focus: { primaryPlay: "Improve the first-session setup", supportingMove: "Interview new signups", maintenanceWork: "Review activation each week" },
      details: true,
    }));

    expect(html).toContain("Also do:");
    expect(html).toContain("Interview new signups");
    expect(html).toContain("Keep checking:");
    expect(html).toContain("Review activation each week");
  });

  it("shows nothing when an older saved decision has no focus", () => {
    expect(renderToStaticMarkup(createElement(DecisionFocus, { focus: null }))).toBe("");
    expect(renderToStaticMarkup(createElement(DecisionFocus, { focus: {}, details: true }))).toBe("");
  });
});
