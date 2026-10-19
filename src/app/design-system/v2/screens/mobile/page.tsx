import type { Metadata } from "next";
import { DocPage, Specimen } from "../../_kit/doc";
import { MobileScreens } from "../../_kit/signal";

export const metadata: Metadata = { title: "Mobile" };

export default function MobileScreenPage() {
  return (
    <DocPage eyebrow="Screens" title="Mobile" intro="The same work on a phone.">
      <Specimen title="Mobile screens"><div className="relative overflow-x-auto"><MobileScreens /></div></Specimen>
    </DocPage>
  );
}
