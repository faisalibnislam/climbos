import type { Metadata } from "next";
import { DesignSystemReference } from "../../DesignSystemReference";
import { DocPage, Specimen } from "../_kit/doc";

export const metadata: Metadata = { title: "Component reference" };

export default function ReferencePage() {
  return (
    <DocPage eyebrow="Screens" title="Component reference" intro="The existing product components in Signal. Kept while pages move to the new set.">
      <Specimen title="Legacy reference"><DesignSystemReference theme="signal" /></Specimen>
    </DocPage>
  );
}
