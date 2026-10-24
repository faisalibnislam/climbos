import { describe, expect, it } from "vitest";
import { assessSearchReadiness } from "@shared/seo/readiness";
import type { ExtractedPage } from "@shared/integrations/website";

const page = (overrides: Partial<ExtractedPage> = {}): ExtractedPage => ({
  og: {}, headings: [], links: [], jsonLdPrices: [], jsonLdTypes: [], text: "", truncated: false, ...overrides,
});

describe("homepage search readiness", () => {
  it("reports only checks supported by extracted page evidence", () => {
    const findings = assessSearchReadiness(page());
    expect(findings.map((finding) => finding.id)).toEqual([
      "missing-title", "missing-description", "missing-h1", "thin-readable-content", "no-structured-data",
    ]);
  });

  it("does not assign a score or report ranking and citation claims", () => {
    const findings = assessSearchReadiness(page({
      title: "A climbing gym", metaDescription: "Climbing for everyone", headings: [{ level: 1, text: "Climb with us" }],
      text: "A readable homepage description. ".repeat(10), jsonLdTypes: ["LocalBusiness"],
    }));
    expect(findings).toEqual([]);
    expect(JSON.stringify(findings)).not.toMatch(/rank|citation|score/i);
  });

  it("flags heading hierarchy gaps and multiple H1 headings", () => {
    const findings = assessSearchReadiness(page({
      title: "Gym", metaDescription: "Climb", text: "text ".repeat(80),
      headings: [{ level: 1, text: "A" }, { level: 3, text: "B" }, { level: 1, text: "C" }], jsonLdTypes: ["LocalBusiness"],
    }));
    expect(findings.map((finding) => finding.id)).toEqual(["multiple-h1", "heading-order"]);
  });
});
