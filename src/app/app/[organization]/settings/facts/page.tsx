"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Check, Pencil, RefreshCw, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";
import { Badge, Button, Card, CardContent, Input, Select, toast } from "@/components/ui";

const CATEGORIES = ["product", "pricing", "offer", "audience", "proof", "brand", "competitor", "other"] as const;

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
  const run = (fn: () => Promise<unknown>, ok?: string) => fn().then(() => ok && toast({ tone: "success", title: ok }), (e) => toast({ tone: "danger", title: errorMessage(e) }));
  if (data === undefined) return <LoadingBlock label="Loading facts" lines={4} />;
  if (data === null) return <p className="text-sm text-ink-3">Finish onboarding first.</p>;
  const pending = data.facts.filter((f) => f.state === "needs_review");
  const known = data.facts.filter((f) => f.state !== "needs_review");
  const statementOf = (id: string | null) => (id ? data.facts.find((f) => f.id === id)?.statement : undefined);
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Business facts"
        intro="What your team uses in every plan, post, page and chat answer. We re-read your website weekly and suggest updates."
        actions={
          data.website ? (
            <Button size="sm" variant="secondary" onClick={() => run(() => checkNow({ slug }), "Checking your site")}>
              <RefreshCw aria-hidden /> Check site now
            </Button>
          ) : null
        }
      />
      {data.siteCheckedAt ? <p className="-mt-4 text-xs text-ink-3">Site checked {relativeTime(data.siteCheckedAt)}.</p> : null}
      {pending.length ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="heading-card">To confirm ({pending.length})</p>
            {pending.map((f) => (
              <div key={f.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{f.statement}</p>
                  {f.replaces ? <p className="text-xs text-ink-3">Replaces: {statementOf(f.replaces) ?? "an older fact"}</p> : null}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => run(() => confirmUpdate({ slug, factId: f.id }), "Confirmed")}>
                    <Check aria-hidden /> Confirm
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Reject" onClick={() => run(() => review({ slug, factId: f.id, action: "reject" }))}>
                    <X aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="heading-card">Known facts ({known.length})</p>
          {known.map((f) =>
            editing?.id === f.id ? (
              <div key={f.id} className="flex gap-2">
                <Input value={editing.text} aria-label="Fact" onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                <Button size="sm" onClick={() => run(async () => { await review({ slug, factId: f.id, action: "edit", statement: editing.text }); setEditing(null); }, "Saved")}>
                  Save
                </Button>
              </div>
            ) : (
              <div key={f.id} className="flex items-start justify-between gap-2 text-sm">
                <span className="min-w-0 text-ink-2">
                  <Badge tone="neutral">{f.category}</Badge> {f.statement}
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing({ id: f.id, text: f.statement })}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => run(() => review({ slug, factId: f.id, action: "reject" }))}>
                    <X aria-hidden />
                  </Button>
                </span>
              </div>
            ),
          )}
          <div className="mt-2 grid gap-2 border-t border-line pt-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as (typeof CATEGORIES)[number] })} aria-label="Category" />
            <Input value={draft.statement} placeholder="Add a fact (e.g. “Free plan: 3 forms, 100 responses a month”)" aria-label="New fact" onChange={(e) => setDraft({ ...draft, statement: e.target.value })} />
            <Button disabled={!draft.statement.trim()} onClick={() => run(async () => { await addFact({ slug, ...draft }); setDraft({ ...draft, statement: "" }); }, "Added")}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
