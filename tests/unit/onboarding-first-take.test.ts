import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RunPreviewSummary } from "../../src/components/app/content/RunProgress";

describe("saved onboarding first take", () => {
  it("keeps the early opportunity visible after research, with uncertainty and evidence states", () => {
    const html = renderToStaticMarkup(createElement(RunPreviewSummary, {
      preview: {
        headline: "Start by checking the main customer benefit.",
        opportunities: [
          { title: "Clarify the homepage offer", why: "The offer appears after several feature details.", nextStep: "Ask three recent visitors what the business sells.", evidence: [], basis: "hypothesis" },
          { title: "Keep the confirmed booking route", why: "The site says customers can book online.", nextStep: "Check that the route is still current.", evidence: [{ factId: "fact_1", statement: "Online booking is available.", kind: "owner_report", provenance: "confirmed_fact" }], basis: "confirmed_facts" },
          { title: "Check the online booking offer", why: "The business site mentions booking.", nextStep: "Review the booking page.", evidence: [{ statement: "Bookings are available online.", provenance: "source_reported", sourceUrl: "https://example.com/book" }], basis: "source_reported" },
        ],
      },
    }));

    expect(html).toContain("First take · preliminary, based on available evidence");
    expect(html).toContain("Hypothesis · no supporting fact or page linked yet");
    expect(html).toContain("What this is based on");
    expect(html).toContain("The website says · check this:");
    expect(html).toContain('href="https://example.com/book"');
    expect(html).toContain("View page");
    expect(html).toContain("Ask three recent visitors what the business sells.");
  });

  it("does not render an empty or missing preview", () => {
    expect(renderToStaticMarkup(createElement(RunPreviewSummary, { preview: null }))).toBe("");
    expect(renderToStaticMarkup(createElement(RunPreviewSummary, { preview: {} }))).toBe("");
  });

  it("labels a saved first take as partial when the deeper research run did not finish", () => {
    const html = renderToStaticMarkup(createElement(RunPreviewSummary, {
      preview: { headline: "Check the customer path." },
      researchComplete: false,
    }));
    expect(html).toContain("Partial first take · some research did not finish");
  });
});
