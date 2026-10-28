"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { CheckStatus } from "@shared/seo/readinessCompare";

const MARK: Record<CheckStatus, string> = { ok: "✓", attention: "Needs attention", unknown: "Not checked" };

type Comparison = { checks: { id: string; title: string; you: CheckStatus; competitors: { name: string; status: CheckStatus }[] }[]; youBehind: string[]; ownCheckedAt: number | null };

/** Homepage search-readiness checks for you beside monitored competitors (HTML signals only; not rankings). */
export function ReadinessComparisonTable({ data }: { data: Comparison }) {
  const names = data.checks[0]?.competitors.map((c) => c.name) ?? [];
  return (
    <section aria-label="Search readiness compared with competitors" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <h2 className="heading-card">Search readiness beside similar businesses</h2>
      {data.youBehind.length ? <p className="text-sm text-ink-2">Others pass checks you don&apos;t: {data.youBehind.join(", ")}.</p> : null}
      {data.ownCheckedAt === null ? <p className="text-sm text-ink-3">Your site hasn&apos;t been checked yet. Run a site check to fill your column.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead><tr className="text-ink-3"><th scope="col" className="py-1 pr-3 font-medium">Homepage check</th><th scope="col" className="py-1 pr-3 font-medium">You</th>{names.map((n) => <th key={n} scope="col" className="py-1 pr-3 font-medium">{n}</th>)}</tr></thead>
          <tbody>
            {data.checks.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 font-normal text-ink">{c.title}</th>
                <td className={c.you === "attention" ? "py-1 pr-3 font-medium text-amber-800" : "py-1 pr-3 text-ink-2"}>{MARK[c.you]}</td>
                {c.competitors.map((x) => <td key={x.name} className="py-1 pr-3 text-ink-2">{MARK[x.status]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">Homepage signals from the latest check, not rankings, traffic or AI citations.</p>
    </section>
  );
}

export function ReadinessComparison({ slug }: { slug: string }) {
  const data = useQuery(api.competitors.readinessComparison, { slug });
  return data ? <ReadinessComparisonTable data={data} /> : null;
}
