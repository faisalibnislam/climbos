"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Check, Pencil, RefreshCw, X } from "@/components/icons"
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";
import { Button, Callout, Card, CardContent, Input, Select, toast } from "@/components/ui";
import { PERMISSION_WHO, useWorkspaceMember } from "@/components/app/content/shared";
import { can } from "@shared/policy";
import { factFreshness } from "@shared/agents/factFreshness";

const CATEGORIES = ["product", "pricing", "offer", "audience", "proof", "brand", "competitor", "other"] as const;
const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  product: "Product",
  pricing: "Pricing",
  offer: "Offer",
  audience: "Customers",
  proof: "Proof",
  brand: "Brand",
  competitor: "Competitor",
  other: "Other",
};

/** What your team knows about the business. Weekly site checks propose updates here. */
export default function FactsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.siteWatch.facts, { slug });
  const review = useMutation(api.orgs.reviewFact);
  const confirmUpdate = useMutation(api.siteWatch.confirmUpdate);
  const addFact = useMutation(api.orgs.addFact);
  const checkNow = useMutation(api.siteWatch.checkNow);
  const [editing, setEditing] = useState<{ id: Id<"businessFacts">; text: string } | null>(null);
  const [draft, setDraft] = useState({ category: "product" as (typeof CATEGORIES)[number], statement: "" });
  const member = useWorkspaceMember(slug);
  const canEdit = Boolean(member?.role && can(member.role, "edit"));
  const run = (fn: () => Promise<unknown>, ok?: string) => fn().then(() => ok && toast({ tone: "success", title: ok }), (e) => toast({ tone: "danger", title: errorMessage(e) }));
  if (data === undefined) return <LoadingBlock label="Loading facts" lines={4} />;
  if (data === null) return <p className="text-sm text-ink-3">Finish onboarding first.</p>;
  const pending = data.facts.filter((f) => f.state === "needs_review");
  const known = data.facts.filter((f) => f.state !== "needs_review");
  const repeatedCount = known.reduce((total, fact) => total + fact.duplicateRecords.length, 0);
  const statementOf = (id: string | null) => (id ? data.facts.find((f) => f.id === id)?.statement : undefined);
  const renderKnownFact = (f: (typeof known)[number]) => editing?.id === f.id ? (
    <div key={f.id} className="flex gap-2">
      <Input value={editing.text} aria-label="Fact" onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
      <Button size="sm" onClick={() => run(async () => { await review({ slug, factId: f.id, action: "edit", statement: editing.text }); setEditing(null); }, "Saved")}>
        Save
      </Button>
    </div>
  ) : (
    <div key={f.id} id={`business-fact-${f.id}`} className="flex items-start justify-between gap-2 text-sm scroll-mt-6">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink-2">{f.statement}</span>
        <span className="text-xs text-ink-3">
          {f.provenance === "owner_supplied" ? "Owner-provided" : f.provenance === "researched" ? "Website research" : "Demo example"} · Last confirmed {relativeTime(f.verifiedAt)}{factFreshness(f.category, f.updatedAt, undefined, f.verifiedAt).reviewSuggested ? " · Worth reviewing" : ""}
        </span>
        {f.sources.length || f.duplicateRecords.length ? (
          <details className="mt-1 text-xs text-ink-3">
            <summary className="cursor-pointer">Evidence and history{f.duplicateRecords.length ? ` · ${f.duplicateRecords.length} repeated ${f.duplicateRecords.length === 1 ? "record" : "records"}` : ""}{f.sources.length ? ` · ${f.sources.length} source${f.sources.length === 1 ? "" : "s"}` : ""}</summary>
            <ul className="mt-2 flex flex-col gap-2 border-l border-line pl-3">
              {f.sources.map((source, index) => (
                <li key={`${source.url ?? source.title ?? source.kind}-${index}`}>
                  <span>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">{source.title || source.url}</a> : source.title || source.kind}</span>
                  <span> · {relativeTime(source.fetchedAt)}{source.status !== "ok" ? ` · ${source.status}` : ""}</span>
                  {source.excerpt ? <p className="mt-0.5 line-clamp-3 text-ink-2">{source.excerpt}</p> : null}
                </li>
              ))}
              {f.duplicateRecords.map((record) => (
                <li key={record.id} className="border-t border-line pt-2">
                  <p className="text-ink-2">Repeated statement: “{record.statement}”</p>
                  <p className="mt-0.5">{record.provenance === "owner_supplied" ? "Owner-provided" : record.provenance === "researched" ? "Website research" : "Demo example"} · Recorded {relativeTime(record.updatedAt)}</p>
                  {record.sources.map((source, index) => (
                    <p key={`${source.url ?? source.title ?? source.kind}-${index}`} className="mt-0.5">
                      {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">{source.title || source.url}</a> : source.title || source.kind}
                      <span> · {relativeTime(source.fetchedAt)}{source.status !== "ok" ? ` · ${source.status}` : ""}</span>
                      {source.excerpt ? <span className="block mt-0.5 line-clamp-3 text-ink-2">{source.excerpt}</span> : null}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      {canEdit ? <span className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing({ id: f.id, text: f.statement })}>
          <Pencil aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => run(() => review({ slug, factId: f.id, action: "reject" }))}>
          <X aria-hidden />
        </Button>
      </span> : null}
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Business facts"
        actions={
          data.website && canEdit ? (
            <Button size="sm" variant="secondary" onClick={() => run(() => checkNow({ slug }), "Checking your site")}>
              <RefreshCw aria-hidden /> Check site
            </Button>
          ) : null
        }
      />
      {data.siteWatchLastError ? <Callout tone="warning" title="The latest website check could not finish">{data.siteWatchLastError}{data.siteWatchLastAttemptAt ? ` · Tried ${relativeTime(data.siteWatchLastAttemptAt)}.` : ""} Your last successful snapshot and confirmed facts are unchanged.</Callout> : data.siteCheckedAt ? <p className="-mt-4 text-xs text-ink-3">Site checked {relativeTime(data.siteCheckedAt)}.</p> : null}
      {data.conflicts.length ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-col gap-2">
            <h2 className="heading-card text-amber-950">Some confirmed facts disagree</h2>
            <p className="text-sm text-amber-950">Please check which information is current before using it to make a growth decision.</p>
            <ul className="flex flex-col gap-3">
              {data.conflicts.map((conflict) => (
                <li key={`${conflict.subject}-${conflict.factIds.join("-")}`} className="border-t border-amber-300 pt-2 first:border-0 first:pt-0">
                  <p className="text-sm font-medium text-amber-950">{conflict.subject}: {conflict.values.join(" vs ")}</p>
                  <ul className="mt-1 flex flex-col gap-1 text-xs text-amber-950">
                    {conflict.facts.map((fact) => (
                      <li key={fact.id}>
                        <a href={`#business-fact-${fact.id}`} className="underline underline-offset-2">{fact.statement}</a>
                        <span className="ml-1">({fact.provenance === "owner_supplied" ? "owner-provided" : "website research"})</span>
                        {fact.sources.map((source, sourceIndex) => source.url ? (
                          <a key={`${source.url}-${sourceIndex}`} href={source.url} target="_blank" rel="noopener noreferrer" className="ml-2 underline underline-offset-2">
                            {source.title || source.url}
                          </a>
                        ) : null)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {data.possibleDuplicateFacts.length ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h2 className="heading-card">Facts that may overlap</h2>
            <p className="text-sm text-ink-3">These statements use similar wording. They may still describe different things, so ClimbOS keeps them separate until your team reviews them.</p>
            <ul className="flex flex-col gap-2">
              {data.possibleDuplicateFacts.map((candidate) => (
                <li key={`${candidate.first.id}-${candidate.second.id}`} className="border-t border-line pt-2 first:border-0 first:pt-0">
                  <a href={`#business-fact-${candidate.first.id}`} className="text-sm text-link underline underline-offset-2">{candidate.first.statement}</a>
                  <span className="mx-1 text-xs text-ink-3">may overlap with</span>
                  <a href={`#business-fact-${candidate.second.id}`} className="text-sm text-link underline underline-offset-2">{candidate.second.statement}</a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {pending.length ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <h2 className="heading-card">To confirm ({pending.length})</h2>
            {pending.map((f) => (
              <div key={f.id} id={`business-fact-${f.id}`} className="flex flex-wrap items-start justify-between gap-2 border-t border-line pt-2 first:border-0 first:pt-0 scroll-mt-6">
                <div className="min-w-0 flex-1">
                  {f.replaces ? (
                    // An update: old and new side by side.
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-lg bg-surface-2 px-3 py-2">
                        <dt className="text-xs text-ink-3">Was</dt>
                        <dd className="text-ink-2 line-through decoration-ink-3/50">{statementOf(f.replaces) ?? "an older fact"}</dd>
                      </div>
                      <div className="rounded-lg border border-line px-3 py-2">
                        <dt className="text-xs text-ink-3">Now</dt>
                        <dd className="text-ink">{f.statement}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-ink">{f.statement}</p>
                  )}
                </div>
                {canEdit ? <div className="flex gap-1">
                  <Button size="sm" onClick={() => run(() => confirmUpdate({ slug, factId: f.id }), "Confirmed")}>
                    <Check aria-hidden /> Confirm
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Reject" onClick={() => run(() => review({ slug, factId: f.id, action: "reject" }))}>
                    <X aria-hidden />
                  </Button>
                </div> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="heading-card">Known facts ({known.length}{repeatedCount ? ` · ${repeatedCount} repeated records` : ""})</h2>
          <p className="text-xs text-ink-3">Older pricing, offers, and other details are marked for review. Age alone does not mean a fact is incorrect.</p>
          {CATEGORIES.map((cat) => [cat, known.filter((fact) => ((CATEGORIES as readonly string[]).includes(fact.category) ? fact.category : "other") === cat)] as const)
            .filter(([, list]) => list.length)
            .map(([cat, list]) => (
              <section key={cat} aria-label={`${CATEGORY_LABEL[cat]} facts`} className="flex flex-col gap-1.5 border-t border-line pt-2 first-of-type:border-0 first-of-type:pt-0">
                <h3 className="text-xs font-medium text-ink-3">
                  {CATEGORY_LABEL[cat]} <span className="tabular-nums">{list.length}</span>
                </h3>
                {list.map(renderKnownFact)}
              </section>
            ))}
          {canEdit ? <div className="mt-2 grid gap-2 border-t border-line pt-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            <Select options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as (typeof CATEGORIES)[number] })} aria-label="Category" />
            <Input value={draft.statement} placeholder="Add a fact" aria-label="New fact" onChange={(e) => setDraft({ ...draft, statement: e.target.value })} />
            <Button disabled={!draft.statement.trim()} onClick={() => run(async () => { await addFact({ slug, ...draft }); setDraft({ ...draft, statement: "" }); }, "Added")}>
              Add
            </Button>
          </div> : <p className="mt-2 border-t border-line pt-3 text-xs text-ink-3">Changing facts needs {PERMISSION_WHO.edit}.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
