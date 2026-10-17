import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design-system guard (docs/DesignSystem.md): app chrome uses only the type
 * scale, three weights, full-strength text tokens and colour tokens. The
 * design canvas (customer designs) and platform look-alike previews are exempt.
 */
const EXEMPT = [/components\/design\/DesignRenderer/, /components\/design\/editor\//, /content\/detail\/ChannelPreview/, /ui\/social-icon/, /app\/design-system\//];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx|ts)$/.test(f) ? [p] : [];
  });
}

const SOURCES = files("src").filter((f) => !EXEMPT.some((re) => re.test(f)));

const RULES: { name: string; re: RegExp }[] = [
  { name: "arbitrary font size (use the type scale)", re: /\btext-\[[0-9.]+(px|rem|em)\]/ },
  { name: "bold/extrabold (use font-medium or font-semibold)", re: /\bfont-(bold|extrabold|black)\b/ },
  { name: "faded text (fails contrast; use ink-2/ink-3)", re: /\btext-(ink|ink-2|ink-3)\/[0-9]+/ },
  { name: "raw hex colour in a class (use tokens)", re: /\b(bg|text|border|fill|stroke|ring|outline|decoration)-\[#[0-9a-fA-F]{3,8}\]/ },
];

describe("design-system guard", () => {
  it("scans the app sources", () => {
    expect(SOURCES.length).toBeGreaterThan(80);
  });
  for (const rule of RULES) {
    it(`no ${rule.name}`, () => {
      const hits = SOURCES.flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .map((line, i) => (rule.re.test(line) ? `${f}:${i + 1}: ${line.trim().slice(0, 120)}` : null))
          .filter(Boolean),
      );
      expect(hits).toEqual([]);
    });
  }
});
