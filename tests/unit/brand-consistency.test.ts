import { expect, it } from "vitest";
import { brandPatterns, designTokens, type BrandSource } from "../../shared/agents/brandConsistency";

it("reads stored visible design tokens, resolves saved brand references and excludes hidden layers", () => {
  const doc = { version: 1, brand: { colors: { primary: "#ABCDEF" }, fonts: { heading: "Inter" } }, pages: [{ background: { kind: "solid", color: "brand:primary" }, layers: [{ type: "group", children: [{ type: "text", fontFamily: "brand:heading", color: "#123456" }, { type: "text", hidden: true, fontFamily: "Secret font", color: "#333333" }] }, { type: "image", src: "https://example.com/image.png" }] }] };
  expect(designTokens(JSON.stringify(doc))).toEqual({ background: ["#abcdef"], fonts: ["Inter"], colors: ["#123456"], limited: true });
  expect(designTokens("invalid").limited).toBe(true);
  expect(designTokens(JSON.stringify({ version: 2 })).fonts).toEqual([]);
});

it("separates recurrence, variation and approved-palette hypotheses without inventing a rule", () => {
  const source = (id: string): BrandSource => ({ id, kind: "page", title: id, version: "Published v1", approval: "published_version", hash: id, updatedAt: 1 });
  const observations = [{ source: source("a"), values: ["#112233"] }, { source: source("b"), values: ["#112233"] }, { source: source("c"), values: ["#445566"] }];
  const pattern = brandPatterns({ page_accent: observations }, ["#112233"])[0];
  expect(pattern).toMatchObject({ repeatedValues: ["#112233"], variation: true, outsidePalette: ["#445566"] });
  expect(brandPatterns({ page_accent: observations }, [])[0].outsidePalette).toEqual([]);
  expect(brandPatterns({ page_accent: [observations[0], observations[0]] }, [])[0].repeatedValues).toEqual([]);
});

it("bounds complex designs and does not invent values for unsupported paint", () => {
  const doc = { version: 1, pages: [{ background: { kind: "solid", color: "brand:missing" }, layers: Array.from({ length: 700 }, (_, i) => ({ type: "text", fontFamily: `Font ${i}`, color: "#000000" })) }] };
  const result = designTokens(JSON.stringify(doc));
  expect(result.limited).toBe(true);
  expect(result.fonts).toHaveLength(24);
  expect(result.background).toEqual([]);
  expect(designTokens(JSON.stringify({ version: 1, pages: [{ background: { kind: "linear", stops: Array.from({ length: 21 }, () => ({ color: "#123456" })) }, layers: [] }] })).limited).toBe(true);
  expect(designTokens(JSON.stringify({ version: 1, pages: [{ layers: [{ type: "text", fontFamily: "brand:missing" }] }] })).limited).toBe(true);
});
