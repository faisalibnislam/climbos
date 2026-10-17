/**
 * WCAG 2.2 contrast maths. Colours may be #rgb/#rrggbb or rgb(r g b / a);
 * translucent colours are composited over the background they sit on.
 */
export type RGB = [number, number, number];

export function parseColor(input: string): { rgb: RGB; alpha: number } {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB, alpha: 1 };
  }
  const fn = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/);
  if (fn) {
    const a = fn[4] === undefined ? 1 : fn[4].endsWith("%") ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]);
    return { rgb: [Number(fn[1]), Number(fn[2]), Number(fn[3])], alpha: a };
  }
  throw new Error(`Unsupported colour: ${input}`);
}

export function composite(fg: string, bg: string): RGB {
  const f = parseColor(fg);
  const b = parseColor(bg).rgb;
  return f.rgb.map((c, i) => Math.round(c * f.alpha + b[i] * (1 - f.alpha))) as RGB;
}

function channel(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio of `fg` drawn on `bg` (bg must be opaque). */
export function contrast(fg: string, bg: string): number {
  const a = luminance(composite(fg, bg));
  const b = luminance(parseColor(bg).rgb);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Read `--name: value;` declarations from the first :root block of a CSS file. */
export function rootTokens(css: string): Record<string, string> {
  const start = css.indexOf(":root {");
  const block = css.slice(start, css.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}
