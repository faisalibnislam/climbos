import type { Metadata } from "next";
import { DocPage, Specimen } from "../../_kit/doc";
import { DashboardScreen } from "../../_kit/signal";

export const metadata: Metadata = { title: "Today" };

export default function TodayScreenPage() {
  return (
    <DocPage eyebrow="Screens" title="Today" intro="The home screen: KPIs, funnel, sources and recent activity.">
      <Specimen title="Today dashboard"><div className="relative overflow-x-auto rounded-[var(--radius-card)]"><div className="min-w-[1200px]"><DashboardScreen /></div></div></Specimen>
    </DocPage>
  );
}
