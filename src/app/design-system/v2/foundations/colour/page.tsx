import type { Metadata } from "next";
import { DocPage, Specimen } from "../../_kit/doc";
import { ColourStandard, ContrastTable, PaletteGrid } from "../../_kit/signal";

export const metadata: Metadata = { title: "Colour" };

export default function ColourPage() {
  return (
    <DocPage eyebrow="Foundations" title="Colour" intro="Sage-tinted ground, white panels, black actions. Lime marks the single most important thing on a screen and never carries small text on white.">
      <Specimen title="Palette"><PaletteGrid exclude={["Charts"]} /></Specimen>
      <Specimen title="Chart colours" description="Series in this order. Sage leads, ink second; grey is always the previous period."><PaletteGrid only={["Charts"]} /></Specimen>
      <Specimen title="Colour standard"><ColourStandard /></Specimen>
      <Specimen title="Contrast"><ContrastTable /></Specimen>
    </DocPage>
  );
}
