import { describe, expect, it } from "vitest";
import { extractSiteInventory } from "../../shared/seo/inventory";

describe("saved website page inventory", () => {
  it("keeps sampled, same-site page metadata and attaches only matching findings", () => {
    const output = JSON.stringify({ auditCoverage: {
      website: {
        requestedUrl: "https://www.example.com/",
        discoveredCandidates: 12,
        pagesSampled: 2,
        pagesRead: 1,
        pages: [
          { url: "https://example.com/pricing/", status: "read" },
          { url: "https://example.com/about/", status: "failed" },
          { url: "https://outside.example/pricing/", status: "read" },
        ],
      },
      seoReadiness: {
        state: "partial",
        pagesWithStaticHtml: 1,
        pages: [{ url: "https://www.example.com/pricing/", metadataState: "observed", titleLength: 52, descriptionLength: 140, headingCounts: { h1: 1, h2: 3, h3: 0 }, canonicalUrl: null, robotsDirectives: null, structuredDataTypes: ["Product"] }],
        findings: [
          { id: "missing-description", level: "attention", title: "Search description is missing", evidence: "No description was observed.", nextStep: "Write one." , pageUrl: "https://example.com/pricing/" },
          { id: "external", level: "attention", title: "External", evidence: "External page.", nextStep: "Ignore.", pageUrl: "https://outside.example/" },
        ],
      },
    } });
    const inventory = extractSiteInventory({ output, runId: "run-1", checkedAt: 123, website: "https://example.com/" });
    expect(inventory).toMatchObject({ runId: "run-1", checkedAt: 123, discoveredCandidates: 12, pagesSampled: 2, pagesRead: 1, pagesWithStaticHtml: 1, state: "partial" });
    expect(inventory?.pages).toHaveLength(2);
    expect(inventory?.pages[0]).toMatchObject({ url: "https://example.com/pricing/", status: "read", metadataState: "observed", titleLength: 52, findings: [{ id: "missing-description" }] });
    expect(inventory?.pages[1]).toMatchObject({ status: "failed", metadataState: "unavailable", findings: [] });
  });

  it("rejects malformed output and audit history from a different website", () => {
    expect(extractSiteInventory({ output: "{", runId: "run-1", checkedAt: 123, website: "https://example.com" })).toBeNull();
    expect(extractSiteInventory({ output: JSON.stringify({ auditCoverage: { website: { requestedUrl: "https://old.example/" } } }), runId: "run-1", checkedAt: 123, website: "https://example.com" })).toBeNull();
  });
});
