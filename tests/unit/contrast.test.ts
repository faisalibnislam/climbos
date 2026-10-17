import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, rootTokens } from "../../shared/a11y/contrast";

/**
 * WCAG 2.2 AA for the design tokens in src/app/globals.css:
 * 4.5:1 for text (1.4.3), 3:1 for control boundaries, focus indicators and
 * meaningful graphics (1.4.11). Any token change that breaks a pair fails CI.
 */
const t = rootTokens(readFileSync("src/app/globals.css", "utf8"));
const WHITE = "#ffffff";
const val = (k: string) => t[k] ?? k;
const ratio = (fg: string, bg: string) => contrast(val(fg), val(bg));

const SURFACES = ["bg", "surface", "surface-2"];
const STATUS = ["green", "amber", "red", "blue", "violet", "teal", "pink", "orange"];

describe("design-token contrast (WCAG 2.2 AA)", () => {
  it("parses the tokens", () => {
    expect(Object.keys(t).length).toBeGreaterThan(40);
  });

  it.each(["ink", "ink-2", "ink-3"].flatMap((fg) => [...SURFACES, "surface-3"].map((bg) => [fg, bg])))("text %s on %s ≥ 4.5", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    [WHITE, "brand-800"],
    [WHITE, "brand-900"],
    [WHITE, "red-800"],
    [WHITE, "ink"],
    ["ink", "sun"],
    ["ink", "sun-soft"],
    ["brand-900", "brand-100"],
    ["brand-900", "brand-50"],
    ["brand-800", "surface"],
    ["brand-800", "bg"],
    ...STATUS.flatMap((c) => [
      [`${c}-800`, `${c}-100`],
      [`${c}-800`, "surface"],
      [`${c}-800`, "bg"],
    ]),
  ])("text %s on %s ≥ 4.5", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ...SURFACES.map((bg) => ["control-border", bg]),
    ["brand-600", "surface"], // focus outline
    ["brand-600", "bg"],
    ["sun-strong", "surface"],
    ["sun-strong", "bg"],
    ...[1, 2, 3, 4, 5, 6].flatMap((i) => [
      [`chart-${i}`, "surface"],
      [`chart-${i}`, "bg"],
    ]),
  ])("non-text %s on %s ≥ 3", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
