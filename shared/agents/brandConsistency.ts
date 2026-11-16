export const BRAND_PATTERN_KEYS = ["page_accent", "page_cta", "design_background", "design_fonts", "design_colors"] as const;
export type BrandPatternKey = typeof BRAND_PATTERN_KEYS[number];
export type BrandPatternState = "confirmed" | "corrected" | "dismissed" | "intentional_exception" | "reopened";
export type BrandSource = { kind: "page" | "design"; id: string; title: string; version: string; approval: "published_version" | "saved_draft"; updatedAt: number; hash: string };
export type BrandObservation = { source: BrandSource; values: string[] };
export type BrandPattern = { key: BrandPatternKey; label: string; observations: BrandObservation[]; repeatedValues: string[]; variation: boolean; outsidePalette: string[]; limitation: string };

const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown) => typeof v === "string" ? v.trim().slice(0, 160) : "";
const hex = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(v) ? v.toLowerCase() : "";
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort();

/** Saved design tokens only. No pixel, image, external CSS or subjective quality inference. */
export function designTokens(raw: string): { background: string[]; fonts: string[]; colors: string[]; limited: boolean } {
  const out = { background: [] as string[], fonts: [] as string[], colors: [] as string[], limited: false };
  let d: Record<string, unknown>;
  try { d = obj(JSON.parse(raw)); } catch { return { ...out, limited: true }; }
  if (d.version !== 1 || !Array.isArray(d.pages)) return { ...out, limited: true };
  const brand = obj(d.brand);
  const paint = (v: unknown) => {
    const s = str(v);
    const value = s.startsWith("brand:") ? obj(brand.colors)[s.slice(6)] : s;
    const color = hex(value);
    if (s && !color) out.limited = true;
    return color;
  };
  const fillColors = (value: unknown) => {
    const f = obj(value);
    if (f.kind === "solid") return [paint(f.color)];
    if (f.kind === "linear" && Array.isArray(f.stops)) {
      if (f.stops.length > 20) out.limited = true;
      return f.stops.slice(0, 20).map(stop => paint(obj(stop).color));
    }
    if (f.kind && f.kind !== "none") out.limited = true;
    return [];
  };
  let visited = 0;
  function layers(values: unknown, depth: number) {
    if (!Array.isArray(values)) { out.limited = true; return; }
    if (depth > 8) { out.limited = true; return; }
    for (const value of values) {
      if (++visited > 500) { out.limited = true; break; }
      const layer = obj(value);
      if (layer.hidden || layer.opacity === 0) continue;
      if (layer.type === "group") layers(layer.children, depth + 1);
      if (layer.type === "text") {
        const font = str(layer.fontFamily);
        const resolvedFont = font.startsWith("brand:") ? str(obj(brand.fonts)[font.slice(6)]) : font;
        if (!resolvedFont) out.limited = true;
        out.fonts.push(resolvedFont);
        out.colors.push(paint(layer.color), paint(obj(layer.background).color));
      }
      if (layer.type === "icon") out.colors.push(paint(layer.color));
      if (layer.type === "shape") out.colors.push(...fillColors(layer.fill), paint(obj(layer.stroke).color));
      if (layer.type === "image") out.limited = true; // Image pixels are not analyzed.
    }
  }
  for (const rawPage of d.pages.slice(0, 20)) {
    const page = obj(rawPage);
    out.background.push(...fillColors(page.background));
    if (obj(page.background).imageSrc) out.limited = true;
    layers(page.layers, 0);
  }
  if (d.pages.length > 20) out.limited = true;
  const background = unique(out.background), fonts = unique(out.fonts), colors = unique(out.colors);
  return { background: background.slice(0, 24), fonts: fonts.slice(0, 24), colors: colors.slice(0, 24), limited: out.limited || Math.max(background.length, fonts.length, colors.length) > 24 };
}

const LABELS: Record<BrandPatternKey, string> = { page_accent: "Hosted-page accent colors", page_cta: "Hosted-page call-to-action wording", design_background: "Design background colors", design_fonts: "Design text fonts", design_colors: "Design text and shape colors" };

export function brandPatterns(observations: Partial<Record<BrandPatternKey, BrandObservation[]>>, approvedColors: string[]): BrandPattern[] {
  const palette = unique(approvedColors.map(hex));
  return BRAND_PATTERN_KEYS.flatMap(key => {
    const rows = (observations[key] ?? []).filter(row => row.values.length);
    if (!rows.length) return [];
    const counts = new Map<string, Set<string>>();
    for (const row of rows) for (const value of unique(row.values)) {
      const sources = counts.get(value) ?? new Set<string>();
      sources.add(`${row.source.kind}:${row.source.id}`);
      counts.set(value, sources);
    }
    return [{ key, label: LABELS[key], observations: rows, repeatedValues: [...counts].filter(([, ids]) => ids.size > 1).map(([value]) => value),
      variation: new Set(rows.map(row => JSON.stringify(unique(row.values)))).size > 1,
      outsidePalette: key === "page_accent" && palette.length ? [...counts.keys()].filter(value => !palette.includes(value)) : [],
      limitation: key === "page_cta" ? "Different offers may need different calls to action. Wording variation is not a defect." : "Saved values are not rendered appearance. Different pages, formats and audiences may justify variation; no single template is required.",
    }];
  });
}

export const BRAND_MAP_POLICY = "BRAND CONSISTENCY REVIEW (same workspace): approved brand rules, saved-document observations and owner decisions are distinct. Confirmed means the observed pattern was acknowledged, not promoted to a universal brand rule. Corrections and intentional exceptions apply only to the exact reviewed sources and brand snapshot. Stale decisions require rechecking. Reopened and dismissed decisions grant no pattern approval; do not carry older confirmations or exceptions forward. Differences are not defects by default. Preserve bold alternatives and the customer's audience, purpose and constraints. This context grants no publishing, editing or spending permission.";
