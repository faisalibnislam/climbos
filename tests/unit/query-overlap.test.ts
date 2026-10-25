import { describe, expect, it } from "vitest";
import { queryPageOverlaps } from "../../shared/seo/queryOverlap";

describe("Search Console query/page overlap", () => {
  it("groups observed impressions by normalized query without inventing a cannibalization verdict", () => {
    const overlaps = queryPageOverlaps([
      { query: "  Best   Clinic ", page: "https://example.com/services/", clicks: 3, impressions: 30, ctr: 0.1, position: 4.2 },
      { query: "best clinic", page: "https://www.example.com/about#team", clicks: 1, impressions: 10, ctr: 0.1, position: 8.1 },
      { query: "best clinic", page: "https://example.com/services/", clicks: 99, impressions: 900, ctr: 0.1, position: 2 },
      { query: "best clinic", page: "https://example.com/no-impressions", clicks: 0, impressions: 0, ctr: 0, position: 0 },
      { query: "private url", page: "https://user:secret@example.com/private", clicks: 1, impressions: 10, ctr: 0.1, position: 1 },
    ]);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toMatchObject({ query: "Best Clinic", pageCount: 2 });
    expect(overlaps[0]?.pages).toHaveLength(2);
    expect(overlaps[0]?.pages[0]?.page).toBe("https://example.com/services");
  });

  it("bounds the number of queries and pages returned", () => {
    const rows = Array.from({ length: 12 }, (_, index) => [0, 1].map((page) => ({
      query: "query " + index,
      page: "https://example.com/" + index + "-" + page,
      clicks: page,
      impressions: 10,
      ctr: 0.1,
      position: 1,
    }))).flat();
    const overlaps = queryPageOverlaps(rows, { maxQueries: 2, maxPagesPerQuery: 2 });
    expect(overlaps).toHaveLength(2);
    expect(overlaps.every((item) => item.pages.length === 2)).toBe(true);
  });
});
