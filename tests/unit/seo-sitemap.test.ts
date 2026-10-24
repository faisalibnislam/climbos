import { describe, expect, it } from "vitest";
import { parseSitemapLocations } from "../../shared/seo/sitemap";

describe("parseSitemapLocations", () => {
  it("decodes XML entities, resolves relative URLs, removes fragments, and deduplicates", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://example.com/a?x=1&amp;y=2#part</loc></url>
      <url><loc>/pricing</loc></url>
      <url><loc>https://example.com/a?x=1&amp;y=2</loc></url>
      <url><loc>javascript:alert(1)</loc></url>
    </urlset>`;
    expect(parseSitemapLocations(xml, "https://example.com/sitemap.xml")).toEqual([
      "https://example.com/a?x=1&y=2",
      "https://example.com/pricing",
    ]);
  });

  it("bounds the result and skips malformed or oversized locations", () => {
    const xml = `<urlset><url><loc>https://example.com/a</loc></url><url><loc>http://[broken</loc></url><url><loc>${"x".repeat(2049)}</loc></url><url><loc>https://example.com/b</loc></url></urlset>`;
    expect(parseSitemapLocations(xml, "https://example.com/sitemap.xml", 1)).toEqual(["https://example.com/a"]);
    expect(parseSitemapLocations(xml, "https://example.com/sitemap.xml", 20)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });
});
