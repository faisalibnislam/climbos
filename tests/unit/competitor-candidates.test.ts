import { describe, expect, it } from "vitest";
import { candidateNameMatchesSite, canonicalCompetitorHost, sameCompetitorSite, selectWatchCandidates } from "../../shared/competitors/candidates";

describe("competitor watch candidates", () => {
  it("normalizes a URL to its vendor host", () => {
    expect(canonicalCompetitorHost("https://www.rival.example/pricing?utm_source=search#plans")).toBe("rival.example");
  });

  it("accepts scheme, www, and subdomain changes but rejects a different canonical site", () => {
    expect(sameCompetitorSite("http://www.rival.example", "https://pricing.rival.example/plans")).toBe(true);
    expect(sameCompetitorSite("https://rival.example", "https://unrelated.example")).toBe(false);
  });

  it("requires the fetched site identity to match the candidate name", () => {
    expect(candidateNameMatchesSite("Rival Software", "https://rival.example", "Rival is a customer support platform.")).toBe(true);
    expect(candidateNameMatchesSite("Rival Software", "https://unrelated.example", "A different company provides accounting tools.")).toBe(false);
  });

  it("drops own-site pages, directories, duplicate domains, and unsourced suggestions", () => {
    const candidates = selectWatchCandidates(
      [
        { name: "Our comparison page", url: "https://www.owner.example/compare/rival", sourceUrl: "https://owner.example/compare/rival" },
        { name: "Rival listing", url: "https://g2.com/products/rival", sourceUrl: "https://g2.com/products/rival" },
        { name: "Rival", url: "https://www.rival.example/pricing", sourceUrl: "https://rival.example/pricing" },
        { name: "Adjacent tool", url: "https://adjacent.example/", sourceUrl: "https://adjacent.example/", kind: "adjacent" },
        { name: "Duplicate", url: "http://rival.example/", sourceUrl: "https://rival.example/" },
        { name: "No source", url: "https://other.example/" },
        { name: "Other", url: "https://other.example/", sourceUrl: "https://other.example/about" },
        { name: "Wrong source", url: "https://different.example/", sourceUrl: "https://research.example/mentions-rival" },
      ],
      "https://owner.example",
    );
    expect(candidates).toEqual([
      { name: "Rival", url: "https://rival.example", sourceUrl: "https://rival.example/pricing" },
      { name: "Other", url: "https://other.example", sourceUrl: "https://other.example/about" },
    ]);
  });

  it("excludes already watched hosts regardless of path or www", () => {
    expect(selectWatchCandidates(
      [{ name: "Rival", url: "https://rival.example/", sourceUrl: "https://rival.example/" }],
      undefined,
      ["http://www.rival.example/pricing"],
    )).toEqual([]);
  });
});
