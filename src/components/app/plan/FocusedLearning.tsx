"use client";

import { useId } from "react";
import { Button } from "@/components/ui";
import { ExperimentOutcome } from "./ExperimentOutcome";
import type { PlanView } from "./PlanSections";

/** Uses the selected plan's existing test; opening or reporting never starts it. */
export function FocusedLearning({ title, experiments, slug, canEdit, onAsk }: {
  title: string;
  experiments: PlanView["experiments"];
  slug: string;
  canEdit: boolean;
  onAsk: (message: string) => void;
}) {
  const heading = useId();
  const matches = experiments.filter(e => e.name === title);
  const test = matches.length === 1 ? matches[0] : null;
  return <section aria-labelledby={heading} className="min-w-0 space-y-3 rounded-xl border border-line bg-surface p-5 sm:p-6">
    <h2 id={heading} className="heading-section">Check your progress</h2>
    <p className="text-sm font-medium">{title}</p>
    {test ? <>
      <p className="max-w-prose text-sm text-ink-2">Record what happened, including an unclear result or a test you didn’t run. Completing tasks alone does not establish a business result.</p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="font-medium">What to watch</dt><dd className="mt-1 text-ink-2">{test.primaryMetric}</dd></div>
        <div><dt className="font-medium">Proposed observation window</dt><dd className="mt-1 text-ink-2">{test.durationDays} day{test.durationDays === 1 ? "" : "s"} once the test runs. Record the actual dates with your result.</dd></div>
      </dl>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">Who, comparison, and when to stop</summary>
        <dl className="space-y-3 pb-3 text-ink-2">
          <div><dt className="font-medium text-ink">What we want to learn</dt><dd>{test.hypothesis}</dd></div>
          <div><dt className="font-medium text-ink">Who takes part</dt><dd>{test.population}</dd></div>
          <div><dt className="font-medium text-ink">Baseline or comparison</dt><dd>{test.baselineBasis || "Not recorded in this saved test. Agree a useful comparison before interpreting the result."}</dd></div>
          <div><dt className="font-medium text-ink">Continue, change, or stop</dt><dd>{test.stoppingRule}</dd></div>
          <div><dt className="font-medium text-ink">Safety limits</dt><dd>{test.guardrails.length ? <ul className="list-disc space-y-1 pl-5">{test.guardrails.map((rule, i) => <li key={i}>{rule}</li>)}</ul> : "None recorded in this saved test."}</dd></div>
        </dl>
      </details>
      <ExperimentOutcome key={test.id} slug={slug} e={test} canEdit={canEdit} />
      {!canEdit && !test.analyses.length ? <p className="text-sm text-ink-2">No outcome recorded yet. A workspace editor can add one.</p> : null}
      <p className="text-xs text-ink-3">An observation alone does not prove cause. Saving a report records learning; it does not approve or start outside work.</p>
    </> : <>
      <p className="text-sm text-ink-2">{matches.length ? "More than one saved test matches this recommendation. Review the tests in Research before choosing which result to record." : "This saved recommendation has no linked test. Define what to watch, who takes part, and when to review before recording a result."}</p>
      {canEdit ? <Button size="sm" variant="secondary" onClick={() => onAsk(`Help me define or identify the test for this saved recommendation: ${title}. Check the existing tests first. Explain what to watch, who takes part, the comparison, review window, and stop rule. Keep missing inputs unknown. Do not start, approve, send, publish, or spend anything.`)}>Discuss the test</Button> : null}
    </>}
  </section>;
}
