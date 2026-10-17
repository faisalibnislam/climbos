/** Fonts available in the design editor (all OFL, self-hosted). Keep in sync with design-fonts.css. */
export interface DesignFont {
  family: string;
  category: "sans" | "serif" | "display" | "rounded" | "handwriting";
  weights: number[];
}

export const DESIGN_FONTS: DesignFont[] = [
  { family: "Plus Jakarta Sans", category: "sans", weights: [400, 600, 700, 800] },
  { family: "Inter", category: "sans", weights: [400, 600, 700, 800, 900] },
  { family: "DM Sans", category: "sans", weights: [400, 600, 700, 800] },
  { family: "Poppins", category: "sans", weights: [400, 600, 700, 800, 900] },
  { family: "Montserrat", category: "sans", weights: [400, 600, 700, 800, 900] },
  { family: "Space Grotesk", category: "sans", weights: [400, 600, 700] },
  { family: "Raleway", category: "sans", weights: [400, 600, 700, 800] },
  { family: "Nunito", category: "rounded", weights: [400, 600, 700, 800, 900] },
  { family: "Oswald", category: "display", weights: [400, 600, 700] },
  { family: "Bebas Neue", category: "display", weights: [400] },
  { family: "Archivo Black", category: "display", weights: [400] },
  { family: "Playfair Display", category: "serif", weights: [400, 600, 700, 800, 900] },
  { family: "DM Serif Display", category: "serif", weights: [400] },
  { family: "Fraunces", category: "serif", weights: [400, 600, 700, 800, 900] },
  { family: "Lora", category: "serif", weights: [400, 600, 700] },
  { family: "Merriweather", category: "serif", weights: [400, 700, 900] },
  { family: "Caveat", category: "handwriting", weights: [400, 700] },
];

export const FONT_STACK_FALLBACK: Record<DesignFont["category"], string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  display: "Impact, ui-sans-serif, sans-serif",
  rounded: "ui-rounded, ui-sans-serif, sans-serif",
  handwriting: "cursive",
};

export function fontStack(family: string): string {
  const f = DESIGN_FONTS.find((x) => x.family === family);
  return `"${family}", ${FONT_STACK_FALLBACK[f?.category ?? "sans"]}`;
}

/** Closest available weight for a family (fonts don't have every weight). */
export function nearestWeight(family: string, weight: number): number {
  const f = DESIGN_FONTS.find((x) => x.family === family);
  if (!f) return weight;
  return f.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), f.weights[0]);
}
