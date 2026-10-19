import type { Metadata } from "next";
import { DocPage, Specimen } from "../../_kit/doc";
import { BodyFonts } from "../../_kit/body-fonts";
import { TypeHierarchy, TypeInContext, VoiceGrid } from "../../_kit/signal";

export const metadata: Metadata = { title: "Typography" };

export default function TypographyPage() {
  return (
    <DocPage
      eyebrow="Foundations"
      title="Typography"
      intro="Reckless Neue sets every title level and ClimbOS's own voice; Hanken Grotesk sets everything you read in bulk, click or compare. The one hero number per screen is Reckless."
    >
      <Specimen title="Type hierarchy"><TypeHierarchy /></Specimen>
      <Specimen title="Voice" description="Where Reckless speaks, and how it looks in a card and in the ink hero.">
        <VoiceGrid />
        <TypeInContext />
      </Specimen>
      <Specimen title="Body font options" description="Hanken Grotesk is chosen. Kept for comparison."><BodyFonts /></Specimen>
    </DocPage>
  );
}
