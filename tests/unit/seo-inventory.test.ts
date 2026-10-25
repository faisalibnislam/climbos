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

  it("flags only sampled pages with no observed incoming links and excludes external links", () => {
    const output = JSON.stringify({ auditCoverage: {
      website: {
        requestedUrl: "https://example.com/",
        discoveredCandidates: 3,
        pagesSampled: 3,
        pagesRead: 3,
        pages: [
          { url: "https://example.com/", status: "read" },
          { url: "https://example.com/pricing", status: "read" },
          { url: "https://example.com/guide", status: "read" },
        ],
      },
      seoReadiness: {
        state: "measured",
        pagesWithStaticHtml: 3,
        pages: [
          { url: "https://example.com/", metadataState: "observed", internalLinks: ["https://example.com/pricing", "https://outside.example/", "https://user:secret@example.com/private"] },
          { url: "https://example.com/pricing", metadataState: "observed", internalLinks: ["https://example.com/"] },
          { url: "https://example.com/guide", metadataState: "observed", internalLinks: [] },
        ],
        findings: [],
      },
    } });

    const inventory = extractSiteInventory({ output, runId: "run-2", checkedAt: 456, website: "https://example.com/" });
    const guide = inventory?.pages.find((page) => page.url.endsWith("/guide"));
    const home = inventory?.pages.find((page) => page.url === "https://example.com/");
    expect(guide?.findings).toContainEqual(expect.objectContaining({
      id: "no-incoming-link-observed-in-sample",
      level: "check",
      evidence: expect.stringContaining("3 sampled pages"),
    }));
    expect(home?.findings).toHaveLength(0);
    expect(inventory?.pages[0]?.internalLinks).toEqual(["https://example.com/pricing"]);
  });
});
