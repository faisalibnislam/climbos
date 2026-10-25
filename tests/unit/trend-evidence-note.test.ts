import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrendEvidenceNote } from "../../src/components/app/content/TrendEvidenceNote";

describe("trend evidence owner note", () => {
  it("shows the source-reported date and keeps the business outcome uncertain", () => {
    const html = renderToStaticMarkup(createElement(TrendEvidenceNote, {
      evidence: {
        sourceUrl: "https://example.com/trend",
        observationDate: "2026-10-20",
        observation: "The source reports a dated format example.",
      },
    }));

    expect(html).toContain('aria-label="Trend evidence"');
    expect(html).toContain('<time dateTime="2026-10-20">2026-10-20</time>');
    expect(html).toContain("The source reports a dated format example.");
    expect(html).toContain("does not prove the trend will fit your audience or improve results");
  });
});
