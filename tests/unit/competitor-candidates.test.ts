import { describe, expect, it } from "vitest";
import { canonicalCompetitorHost, selectWatchCandidates } from "../../shared/competitors/candidates";

describe("competitor watch candidates", () => {
  it("normalizes a URL to its vendor host", () => {
    expect(canonicalCompetitorHost("https://www.rival.example/pricing?utm_source=search#plans")).toBe("rival.example");
  });

  it("drops own-site pages, directories, duplicate domains, and unsourced suggestions", () => {
    const candidates = selectWatchCandidates(
      [
        { name: "Our comparison page", url: "https://www.owner.example/compare/rival", sourceUrl: "https://owner.example/compare/rival" },
        { name: "Rival listing", url: "https://g2.com/products/rival", sourceUrl: "https://g2.com/products/rival" },
        { name: "Rival", url: "https://www.rival.example/pricing", sourceUrl: "https://rival.example/pricing" },
        { name: "Duplicate", url: "http://rival.example/", sourceUrl: "https://rival.example/" },
        { name: "No source", url: "https://other.example/" },
        { name: "Other", url: "https://other.example/", sourceUrl: "https://research.example/other" },
      ],
      "https://owner.example",
    );
    expect(candidates).toEqual([
      { name: "Rival", url: "https://rival.example", sourceUrl: "https://rival.example/pricing" },
      { name: "Other", url: "https://other.example", sourceUrl: "https://research.example/other" },
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
