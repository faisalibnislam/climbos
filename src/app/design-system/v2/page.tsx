import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { DocPage, Specimen } from "./_kit/doc";
import { Hero, LogoPairs } from "./_kit/signal";
import { NAV } from "./nav";

export const metadata: Metadata = { title: { absolute: "Design system · Signal" } };

const PRINCIPLES: [string, string][] = [
  ["Calm ground, one loud thing", "Sage ground, white panels, black actions. Lime marks the single most important thing on a screen."],
  ["Reckless speaks, Hanken works", "Reckless for titles and ClimbOS's voice; Hanken for everything you read in bulk, click or compare."],
  ["Sharp and small", "Corners stop at 8px; icons are our own Sharp set with square caps."],
  ["Show the work", "Live progress, time left and every step wherever ClimbOS is working."],
  ["Few words", "Short labels, bullets and tables over paragraphs."],
  ["Accessible by default", "WCAG 2.2 AA everywhere, AAA for body text, visible focus, keyboard first."],
];

export default function OverviewPage() {
  return (
    <DocPage eyebrow="Signal · v2" title="Design system" intro="Foundations, components and patterns for ClimbOS. Use ⌘K to jump to any element; switch density in the top bar.">
      <Specimen title="Principles">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PRINCIPLES.map(([t, d]) => (
            <div key={t} className="rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
              <p className="heading-card">{t}</p>
              <p className="mt-1 text-sm text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen title="Contents">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {NAV.slice(1).map((g) => (
            <div key={g.title} className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
              <p className="text-overline mb-1">{g.title}</p>
              {g.items.map((i) => (
                <Link key={i.href} href={i.href} className="group flex items-center justify-between rounded-[var(--radius-control)] py-1 text-ui text-ink-2 hover:text-ink">
                  {i.title}
                  <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen title="Brand" description="The mark on ink and on lime. On cream or ground, use the ink logo.">
        <LogoPairs />
      </Specimen>
      <Specimen title="Marketing hero" description="Marketing surfaces use the CTA radius and pill-shaped calls to action.">
        <Hero />
      </Specimen>
    </DocPage>
  );
}
