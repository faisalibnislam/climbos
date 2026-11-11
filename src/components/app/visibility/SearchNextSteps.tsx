"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, toast } from "@/components/ui";
import { askDraftKey } from "../draftKeys";
import { searchConsolePropertyMatchesWebsite } from "@shared/integrations/searchConsole";
import { searchConsoleRefreshCandidates } from "@shared/agents/searchConsoleEvidence";

/** Expose the same observed page candidates the planner already receives. */
export function SearchNextSteps({ slug, website }: { slug: string; website: string | null }) {
  const report = useQuery(api.searchConsole.observations, { slug });
  const me = useQuery(api.orgs.me);
  const router = useRouter();
  const matched = Boolean(report && website && searchConsolePropertyMatchesWebsite(report.property, website));
  const candidates = matched && report ? searchConsoleRefreshCandidates(report.rows, 3) : [];
  const prepare = (page: string, queries: string[]) => {
    if (!me?.userId || !report) return;
    const draft = `Help me decide whether to improve this existing page before creating more SEO content: ${page}. People found it through these searches from ${report.startDate} to ${report.endDate}: ${JSON.stringify(queries)}. What are those visitors trying to do, and does this page help them? Recommend one useful change to test, explain why it matters to the business, and suggest a clear next step for the visitor. If the evidence does not support a change, say so. These search observations do not tell us total demand or how many visitors became customers. Give me advice to review before changing the website.`;
    try {
      sessionStorage.setItem(askDraftKey(slug, me.userId), draft);
      router.push(`/app/${encodeURIComponent(slug)}/today`);
    } catch {
      toast({ tone: "info", title: "Your browser could not save the request", description: "Open Home and ask for a review of this page." });
    }
  };
  return (
    <section aria-labelledby="search-next-heading">
      <Card><CardContent className="flex flex-col gap-3">
        <h2 id="search-next-heading" className="heading-section">What to work on in search</h2>
        {report?.isFixture ? <p className="text-xs font-medium text-ink-3">Demo data · simulated search observations</p> : null}
        {report === undefined ? <p className="text-sm text-ink-3">Checking available search data…</p> : candidates.length && report ? <>
          <p className="text-sm text-ink-2">Start by reviewing pages already appearing for searches. These are candidates to inspect, not a forecast that editing them will bring customers.</p>
          <p className="text-xs text-ink-3">{report.startDate} to {report.endDate} · observed query/page rows{report.truncated ? " · partial, capped report" : ""}</p>
          <ol className="flex flex-col gap-3">{candidates.map((candidate) => {
            const queries = report.rows.filter((row) => row.page.replace(/\/$/, "") === candidate.page).sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((row) => row.query);
            return <li key={candidate.page} className="rounded-[var(--radius-control)] border border-line p-3">
              <a href={candidate.page} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-link underline">{candidate.page}</a>
              <p className="mt-1 text-sm text-ink-2">Searches observed: {queries.join(" · ") || "No query details"}</p>
              <p className="mt-1 text-xs text-ink-3">{candidate.impressions.toLocaleString()} impressions · {candidate.clicks.toLocaleString()} clicks in these rows. Review whether the page answers the useful buyer question before adding more content.</p>
              <Button size="sm" variant="secondary" className="mt-3" disabled={!me?.userId} onClick={() => prepare(candidate.page, queries)}>Prepare a page-review request</Button>
            </li>;
          })}</ol>
          <p className="text-xs text-ink-3">Preparing a request only fills an editable draft on Home. You decide whether to send it.</p>
        </> : <>
          <p className="text-sm text-ink-2">{report && !matched ? "The connected search property does not match this website. Check it before using those numbers." : matched ? "No observed page falls in the current review band. That does not mean there are no useful search opportunities." : "No matched search-performance data is available yet. Start with a question a real buyer asks and inspect the page that should answer it."}</p>
          <p className="text-sm text-ink-2">A useful recommendation names the buyer question, the page, the answer or proof to improve, and the next step for that visitor. Homepage checks below cover technical access only.</p>
          <Link href={`/app/${encodeURIComponent(slug)}/connections`} className="min-h-9 text-sm text-link underline underline-offset-4">Check Search Console connection</Link>
        </>}
      </CardContent></Card>
    </section>
  );
}
