import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PlanCheckSummary } from "../../src/components/app/plan/PlanCheckSummary";

it("shows the saved reason first and keeps all other reasons and fixes inspectable", () => {
  const html = renderToStaticMarkup(createElement(PlanCheckSummary, { quality: { reasons: ["", "The proposed spend needs demand evidence.", "Available capacity is unknown."], fixes: [{ rule: "demand_gate", path: "channels[0].suggestedMonthlyAdSpend", message: "Prepare an unpaid demand test first." }] } }));
  expect(html.indexOf("The proposed spend needs demand evidence.")).toBeLessThan(html.indexOf("<details>"));
  expect(html).toContain("What needs fixing");
  expect(html).toContain("Available capacity is unknown.");
  expect(html).toContain("Prepare an unpaid demand test first.");
  expect(html).toContain("Channels 1");
  expect(html).not.toContain("suggestedMonthlyAdSpend");
  expect(html).not.toContain("demand_gate");
});

it("does not invent an explanation for a legacy failed check", () => {
  const html = renderToStaticMarkup(createElement(PlanCheckSummary, { quality: { reasons: [] } }));
  expect(html).toContain("No detailed explanation was saved for this version.");
  expect(html).not.toContain("<details>");
});
