"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { leadScoreLines, type ScoreComparison } from "@shared/growth/leadScores";

/** Whether this workspace's prospect scores have separated reply and booking outcomes (association, not cause). */
export function LeadScoreCheckCard({ comparisons }: { comparisons: ScoreComparison[] }) {
  const lines = leadScoreLines(comparisons);
  if (!lines.length) return null;
  return (
    <section aria-label="Prospect score check" className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm">
      <h2 className="heading-card">Are the prospect scores working?</h2>
      <ul className="list-disc pl-5 text-ink-2">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
      <p className="text-xs text-ink-3">Compares prospects scored 70 or more with the rest, using first contacts old enough to have an outcome. A difference is only called when the ranges don&apos;t overlap. This shows association, not cause.</p>
    </section>
  );
}

export function LeadScoreCheck({ slug }: { slug: string }) {
  const comparisons = useQuery(api.learning.leadScoreCalibration, { slug });
  return comparisons ? <LeadScoreCheckCard comparisons={comparisons} /> : null;
}
