import type { Metadata } from "next";
import { DocPage, Specimen } from "../../_kit/doc";
import { IconGridSpec, IconSet, IconSizes } from "../../_kit/signal";

export const metadata: Metadata = { title: "Icons" };

export default function IconsPage() {
  return (
    <DocPage eyebrow="Foundations" title="Icons" intro="ClimbOS Sharp: our own set on a 24px grid, 1.5px stroke, square caps, mitred joins and hard corners. Import from @/components/icons.">
      <Specimen title="ClimbOS Sharp"><IconSet /></Specimen>
      <Specimen title="Icon sizes" description="16px inline with text, 20px in buttons and nav, 24px standalone."><IconSizes /></Specimen>
      <Specimen title="Icon grid"><IconGridSpec /></Specimen>
    </DocPage>
  );
}
