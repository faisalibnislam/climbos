"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, toast } from "@/components/ui";
import { ExperimentOutcome } from "./ExperimentOutcome";
import { errorMessage } from "../errors";

export function DesignResults({ slug, runId, findingIndex }: { slug: string; runId: Id<"workflowRuns">; findingIndex: number }) {
  const result = useQuery(api.designCritic.results, { slug, runId, findingIndex });
  const create = useMutation(api.designCritic.createResultTest);
  return <details className="mt-3 border-t border-line pt-2"><summary className="min-h-9 cursor-pointer text-sm font-medium">Did this page change help?</summary><div className="mt-2 space-y-3 text-sm text-ink-2">
    <p>Link the saved page version to a test and its recorded results. A before/after comparison shows an association, not proof the design caused the result.</p>
    {!result ? <p>Checking related drafts and tests…</p> : <>
      {!result.pages.length ? <p>Choose a direction and prepare its page draft first. Save the measurement plan in the page editor.</p> : result.pages.map((page) => <div key={page.id} className="rounded-lg border border-line p-3"><Link href={`/app/${encodeURIComponent(slug)}/pages?id=${page.id}`} className="text-link underline">{page.title} · draft v{page.version}</Link>{result.canEdit ? <Button className="mt-2 min-h-11" variant="secondary" disabled={!page.measurementReady} onClick={async () => { try { await create({ slug, pageId: page.id, expectedVersion: page.version }); toast({ tone: "success", title: "Test defined", description: "It is still proposed. Nothing has launched." }); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } }}>Define a test for this version</Button> : null}{!page.measurementReady ? <p className="mt-1 text-xs text-ink-3">Save a measurement plan for this exact version in the editor first.</p> : null}</div>)}
      {result.truncated ? <p>Showing the latest 20 tests for this finding.</p> : null}
      {result.tests.map((test) => <div key={test.id} className="rounded-lg border border-line p-3"><p className="font-medium">{test.name} · page v{test.pageVersion} · {test.status}</p><ExperimentOutcome slug={slug} e={test} canEdit={result.canEdit} /><DesignLearningNote learning={test.learning} /></div>)}
    </>}
  </div></details>;
}

type DesignLearning = FunctionReturnType<typeof api.designCritic.results>["tests"][number]["learning"];

export function DesignLearningNote({ learning }: { learning: DesignLearning }) {
  if (!learning) return <p className="mt-2 text-xs text-ink-3">A verified link to the original audit and page version is unavailable. This result is not used as a design lesson.</p>;
  const source = learning.outcome?.source;
  const sourceLabel = source === "integration" ? "Connected tool, as reported by the person recording it" : source === "platform_report" ? "Platform report, as reported by the person recording it" : "Owner report";
  return <div className="mt-3 border-t border-line pt-2">
    <p>{learning.assessment.summary}</p>
    <details className="mt-1">
    <summary className="min-h-9 cursor-pointer font-medium">How later advice uses this result</summary>
    <div className="mt-2 space-y-2">
      <p className="text-xs text-ink-3">Page v{learning.pageVersion} · {learning.publicationConfirmed ? "Publication approval recorded" : "Publication approval unverified"}{learning.publicationApprovedAt !== null ? ` · ${new Date(learning.publicationApprovedAt).toISOString().slice(0, 10)} (UTC)` : " · approval time unknown"}</p>
      {learning.outcome ? <p className="text-xs text-ink-3">{learning.metric} · {sourceLabel} · {learning.outcome.windowStart ?? "Start unknown"} to {learning.outcome.windowEnd ?? "End unknown"}</p> : null}
      {learning.assessment.limits.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-ink-3">{learning.assessment.limits.map(limit => <li key={limit}>{limit}</li>)}</ul> : null}
      <p className="text-xs text-ink-3">Later website reviews and growth plans may use recent result reports from this workspace to shape another test. This does not publish a variant or change a live page.</p>
    </div>
    </details>
  </div>;
}
