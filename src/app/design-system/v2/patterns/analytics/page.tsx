import type { Metadata } from "next";
import { DocPage, Specimen } from "../../_kit/doc";
import { AnalyticsShowcase } from "../../_kit/analytics-showcase";

export const metadata: Metadata = { title: "Analytics showcase" };

export default function AnalyticsPage() {
  return (
    <DocPage eyebrow="Patterns" title="Analytics showcase" intro="Our own chart language in a bento: one ink hero per screen, hover details and a gentle entry.">
      <Specimen title="Analytics bento"><AnalyticsShowcase /></Specimen>
    </DocPage>
  );
}
