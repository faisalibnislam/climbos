"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "next/navigation";
import { RefreshCw, Search } from "@/components/icons";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Button, Callout, Card, CardContent, EmptyState, toast } from "@/components/ui";
import { useWorkspaceMember } from "@/components/app/content/shared";
import { can } from "@shared/policy";

export default function SearchReadinessPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.siteWatch.searchReadiness, { slug });
  const scan = useMutation(api.siteWatch.scanSearchReadiness);
  const member = useWorkspaceMember(slug);
  const canEdit = Boolean(member?.role && can(member.role, "edit"));
  if (data === undefined) return <LoadingBlock label="Loading search readiness" lines={4} />;
  if (data === null) return <p className="text-sm text-ink-3">Finish onboarding first.</p>;
  const current = data.scan;
  const run = () => scan({ slug }).then(() => toast({ tone: "success", title: "Homepage check started" }), (error) => toast({ tone: "danger", title: errorMessage(error) }));
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        section="search readiness"
        title="Search readiness"
        intro="Check what search tools and answer systems can read from your homepage."
        actions={data.website && canEdit ? <Button size="sm" variant="secondary" loading={current?.status === "queued"} disabled={current?.status === "queued"} onClick={run}><RefreshCw aria-hidden /> Check homepage</Button> : null}
      />
      <Callout tone="info">This checks visible page structure and structured data. It does not measure rankings, indexing, or AI citations.</Callout>
      {!data.website ? (
        <EmptyState icon={<Search />} title="Add your website first" body={<span>Set your business website in <a className="underline underline-offset-2" href={`/app/${slug}/settings/facts`}>Business facts</a>, then run a homepage check.</span>} />
      ) : !current ? (
        <EmptyState icon={<Search />} title="No homepage check yet" body="Run a check to see specific page details and practical next steps." action={canEdit ? <Button onClick={run}><Search aria-hidden /> Check homepage</Button> : undefined} />
      ) : current.status === "queued" ? (
        <Card><CardContent className="flex flex-col gap-2"><h2 className="heading-card">Reading your homepage</h2><p className="text-sm text-ink-2">This usually takes a few seconds. You can stay on this page while the result updates.</p></CardContent></Card>
      ) : current.status === "failed" ? (
        <Card><CardContent className="flex flex-col gap-2"><h2 className="heading-card">We couldn’t read this page</h2><p className="text-sm text-ink-2">{current.error ?? "The homepage could not be checked."}</p>{current.checkedAt ? <p className="text-xs text-ink-3">Attempted {relativeTime(current.checkedAt)}.</p> : null}</CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="heading-card">Homepage details</h2><a href={current.pageUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-ink-3 underline underline-offset-2">{current.pageUrl}</a></div><p className="shrink-0 text-xs text-ink-3">Checked {current.checkedAt ? relativeTime(current.checkedAt) : "recently"}</p></div>
            <dl className="grid gap-3 pt-2 text-sm sm:grid-cols-2"><div><dt className="text-xs text-ink-3">Page title</dt><dd className="text-ink-2">{current.pageTitle || "Not found"}</dd></div><div><dt className="text-xs text-ink-3">Search description</dt><dd className="text-ink-2">{current.description || "Not found"}</dd></div><div><dt className="text-xs text-ink-3">Headings extracted</dt><dd className="text-ink-2">{current.headingCount ?? 0}</dd></div><div><dt className="text-xs text-ink-3">Structured data types</dt><dd className="text-ink-2">{current.structuredDataTypes?.length ? current.structuredDataTypes.join(", ") : "None detected"}</dd></div></dl>
          </CardContent></Card>
          <section className="flex flex-col gap-3"><div><h2 className="heading-card">What to review</h2><p className="mt-1 text-sm text-ink-3">These checks describe this page only; they are not ranking or citation predictions.</p></div>
            {current.findings?.length ? <ul className="flex flex-col gap-3">{current.findings.map((finding) => <li key={finding.id}><Card><CardContent className="flex flex-col gap-2"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-ink">{finding.title}</h3><span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3">{finding.level === "attention" ? "Needs attention" : "Review"}</span></div><p className="text-sm text-ink-2">{finding.evidence}</p><p className="text-sm"><span className="font-medium text-ink">Next step: </span><span className="text-ink-2">{finding.nextStep}</span></p></CardContent></Card></li>)}</ul> : <EmptyState icon={<Search />} title="No obvious issues found" body="The checks we ran found a title, description, main heading, readable text, and structured data. This does not guarantee rankings or citations." />}
          </section>
        </>
      )}
    </div>
  );
}
