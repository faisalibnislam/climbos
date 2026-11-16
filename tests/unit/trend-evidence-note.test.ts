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
  it("shows the actual retrieval time separately from the observation date", () => {
    const html = renderToStaticMarkup(createElement(TrendEvidenceNote, { evidence: {
      sourceUrl: "https://example.com/trend", observationDate: "2026-10-20", observation: "A source report.", retrievedAt: Date.parse("2026-10-21T12:34:00Z"),
    } }));
    expect(html).toContain("2026-10-21 12:34");
    expect(html).toContain('href="https://example.com/trend"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('dateTime="2026-10-20"');
  });

  it("keeps missing retrieval time unknown and does not link unsafe URLs", () => {
    const html = renderToStaticMarkup(createElement(TrendEvidenceNote, { evidence: {
      sourceUrl: "javascript:alert(1)", observationDate: "2026-10-20", observation: "A legacy report.",
    } }));
    expect(html).toContain("retrieval time was not recorded");
    expect(html).not.toContain("href=");
  });

});
