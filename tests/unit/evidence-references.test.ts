import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvidenceReferences } from "../../src/components/app/plan/EvidenceReferences";

describe("recommendation evidence references", () => {
  it("links business facts to plan sources and opens cited pages directly", () => {
    const html = renderToStaticMarkup(createElement(EvidenceReferences, {
      references: ["fact:0", "https://example.com/pricing", "review note"],
    }));

    expect(html).toContain('href="#sources-heading"');
    expect(html).toContain("Business fact reference 1 · see plan sources");
    expect(html).toContain('href="https://example.com/pricing"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("example.com/pricing");
    expect(html).toContain("review note");
  });

  it("renders no reference list when there is no direct evidence", () => {
    expect(renderToStaticMarkup(createElement(EvidenceReferences, { references: [] }))).toBe("");
  });
});
