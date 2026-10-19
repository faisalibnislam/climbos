import type { Metadata } from "next";
import { DocPage, Specimen } from "../../_kit/doc";
import { ReportsScreen } from "../../_kit/signal";

export const metadata: Metadata = { title: "Results" };

export default function ResultsScreenPage() {
  return (
    <DocPage eyebrow="Screens" title="Results" intro="Reports with this period against the previous one.">
      <Specimen title="Results report"><div className="relative overflow-x-auto rounded-[var(--radius-card)]"><div className="min-w-[1200px]"><ReportsScreen /></div></div></Specimen>
    </DocPage>
  );
}
