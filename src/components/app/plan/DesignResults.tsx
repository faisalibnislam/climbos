"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
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
      {result.tests.map((test) => <div key={test.id} className="rounded-lg border border-line p-3"><p className="font-medium">{test.name} · page v{test.pageVersion} · {test.status}</p><ExperimentOutcome slug={slug} e={test} canEdit={result.canEdit} /></div>)}
    </>}
  </div></details>;
}
