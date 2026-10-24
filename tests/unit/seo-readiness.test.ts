import { describe, expect, it } from "vitest";
import { assessSearchReadiness } from "@shared/seo/readiness";
import type { ExtractedPage } from "@shared/integrations/website";

const page = (overrides: Partial<ExtractedPage> = {}): ExtractedPage => ({
  og: {}, headings: [], links: [], jsonLdPrices: [], jsonLdTypes: [], text: "", truncated: false, viewportPresent: true, imageCount: 0, imagesWithAltAttribute: 0, htmlLang: "en", ...overrides,
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

  it("distinguishes malformed JSON-LD from absent structured data", () => {
    const findings = assessSearchReadiness(page({ title: "Guide", metaDescription: "A guide", text: "Useful page text. ".repeat(20), jsonLdScriptParseErrors: 2 }));
    expect(findings.map((finding) => finding.id)).toContain("invalid-json-ld");
    expect(findings.map((finding) => finding.id)).not.toContain("no-structured-data");
    expect(findings.find((finding) => finding.id === "invalid-json-ld")).toMatchObject({ level: "attention", evidence: expect.stringContaining("2") });
    expect(JSON.stringify(findings)).not.toMatch(/will rank|will be cited|citation rate/i);
  });

  it("flags heading hierarchy gaps and multiple H1 headings", () => {
    const findings = assessSearchReadiness(page({
      title: "Gym", metaDescription: "Climb", text: "text ".repeat(80),
      headings: [{ level: 1, text: "A" }, { level: 3, text: "B" }, { level: 1, text: "C" }], jsonLdTypes: ["LocalBusiness"],
    }));
    expect(findings.map((finding) => finding.id)).toEqual(["multiple-h1", "heading-order"]);
  });

  it("reports observable indexing and AI-search crawler barriers without predicting visibility", () => {
    const findings = assessSearchReadiness(page({ robotsDirectives: "index, nofollow, noindex" }), {
      httpStatus: 200,
      canonicalUrl: "https://other.example/",
      pageUrl: "https://site.example/",
      robotsDirectives: "index, nofollow, noindex",
      robotsFileStatus: "available",
      crawlerChecks: [{ crawler: "Googlebot", allowed: true }, { crawler: "Bingbot", allowed: false }, { crawler: "OAI-SearchBot", allowed: false }],
    });
    expect(findings.map((finding) => finding.id)).toEqual(expect.arrayContaining(["page-noindex", "cross-site-canonical", "robots-bingbot", "robots-oai-searchbot"]));
    expect(JSON.stringify(findings)).not.toMatch(/will rank|will be cited|citation rate/i);
  });

  it("separates AI search access findings from provider data-use controls", () => {
    const findings = assessSearchReadiness(page(), {
      httpStatus: 200,
      pageUrl: "https://site.example/",
      robotsFileStatus: "available",
      crawlerChecks: [
        { crawler: "PerplexityBot", allowed: false },
        { crawler: "Claude-SearchBot", allowed: false },
        { crawler: "GPTBot", allowed: false },
        { crawler: "ClaudeBot", allowed: false },
        { crawler: "Google-Extended", allowed: false },
      ],
    });
    expect(findings.find((finding) => finding.id === "robots-perplexitybot")?.nextStep).toMatch(/discover or cite.*not a guarantee/i);
    expect(findings.find((finding) => finding.id === "robots-claude-searchbot")?.nextStep).toMatch(/discover or cite.*not a guarantee/i);
    for (const crawler of ["gptbot", "claudebot", "google-extended"]) {
      expect(findings.find((finding) => finding.id === `robots-${crawler}`)?.nextStep).toMatch(/data use.*not ordinary search visibility/i);
    }
  });

  it("does not treat a failed robots.txt check as crawler permission", () => {
    const findings = assessSearchReadiness(page(), {
      httpStatus: 200, pageUrl: "https://site.example/", robotsFileStatus: "unavailable",
      crawlerChecks: [{ crawler: "Googlebot", allowed: false }, { crawler: "Bingbot", allowed: false }, { crawler: "OAI-SearchBot", allowed: false }],
    });
    expect(findings.map((finding) => finding.id)).toEqual(expect.arrayContaining(["robots-unavailable"]));
    expect(findings.map((finding) => finding.id)).not.toEqual(expect.arrayContaining(["robots-googlebot", "robots-bingbot", "robots-oai-searchbot"]));
  });

  it("detects noindex sent in the HTTP X-Robots-Tag response header", () => {
    const findings = assessSearchReadiness(page(), {
      httpStatus: 200,
      pageUrl: "https://site.example/guide",
      xRobotsTag: "noindex, follow",
      robotsFileStatus: "not_found",
      crawlerChecks: [{ crawler: "Googlebot", allowed: true }, { crawler: "Bingbot", allowed: true }, { crawler: "OAI-SearchBot", allowed: true }],
    });
    expect(findings).toContainEqual(expect.objectContaining({ id: "page-noindex", level: "attention" }));
    expect(findings.find((finding) => finding.id === "page-noindex")?.evidence).toContain("X-Robots-Tag: noindex, follow");
  });

  it("flags missing viewport and image alt attributes as checks, not ranking claims", () => {
    const findings = assessSearchReadiness(page({ imageCount: 2, imagesWithAltAttribute: 1, viewportPresent: false }));
    expect(findings.map((finding) => finding.id)).toEqual(expect.arrayContaining(["missing-viewport", "missing-image-alt"]));
    expect(findings.find((finding) => finding.id === "missing-image-alt")?.evidence).toContain("1 of 2");
    expect(JSON.stringify(findings)).not.toMatch(/ranking factor|will rank/i);
  });

  it("flags an absent document language with a specific accessibility next step", () => {
    const finding = assessSearchReadiness(page({ htmlLang: "  " })).find((item) => item.id === "missing-document-language");
    expect(finding).toMatchObject({ level: "check", title: "Document language was not declared" });
    expect(finding?.nextStep).toMatch(/primary language on the html element/i);
  });
});
