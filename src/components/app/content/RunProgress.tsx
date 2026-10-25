"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { RunPreview as RunPreviewData } from "@convex/content";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button, Callout, Progress, Skeleton, type StepItem, type StepStatus } from "@/components/ui";
import { errorMessage } from "../errors";
import { cn } from "@/lib/utils";
import { formatDuration, formatEta, phaseOf, progressOfRun } from "../../../../shared/progress";
import { microsToCreditsLabel } from "../money";
import { roleTitle } from "../roles";
import { Highlight } from "@/components/ds/content";
import { MessageText, useWorkspaceMember } from "./shared";
import { can } from "@shared/policy";

export type RunStatusView = FunctionReturnType<typeof api.content.runStatus>;

/** Retain the useful first take after onboarding research finishes, before a full plan exists. */
export function RunPreviewSummary({ preview, researchComplete = true }: { preview: RunPreviewData | null; researchComplete?: boolean }) {
  if (!preview || (!preview.headline && !preview.points?.length && !preview.opportunities?.length && !preview.channels?.length && !preview.plays?.length)) return null;
  return <EarlyPreview preview={preview} finished researchComplete={researchComplete} />;
}

export const RUN_STATUS_LABEL: Record<string, string> = {
  proposed: "Queued",
  cost_reserved: "Getting ready",
  preparing: "Working on it",
  needs_approval: "Waiting for approval",
  approved: "Approved",
  scheduled: "Scheduled",
  executing: "Working on it",
  verified: "Done",
  failed: "Didn't finish",
  uncertain: "Outcome uncertain",
  paused: "Paused",
  canceled: "Canceled",
};

export const RUN_STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "violet"> = {
  proposed: "neutral",
  cost_reserved: "blue",
  preparing: "blue",
  needs_approval: "amber",
  approved: "green",
  scheduled: "blue",
  executing: "blue",
  verified: "green",
  failed: "red",
  uncertain: "amber",
  paused: "amber",
  canceled: "neutral",
};

/** Statuses after which a run won't change on its own. */
export const RUN_FINISHED = new Set(["verified", "failed", "canceled", "uncertain", "needs_approval"]);

function stepStatus(s: string): StepStatus {
  if (s === "running") return "running";
  if (s === "succeeded" || s === "skipped") return "done";
  if (s === "failed" || s === "uncertain") return "failed";
  return "pending";
}

export function runSteps(run: RunStatusView): StepItem[] {
  return run.steps.map((s, i) => ({
    key: `${i}-${s.label}`,
    label: s.label,
    status: stepStatus(s.status),
    detail: [s.role ? roleTitle(s.role) : null, s.status === "skipped" ? "Skipped" : null, s.status === "uncertain" ? "Outcome uncertain" : null]
      .filter(Boolean)
      .join(" · ") || undefined,
  }));
}

/** Friendly names for the phases inside an agent's work. */
function phaseName(label: string): string {
  const ph = phaseOf(label);
  const round = label.match(/(\d+)$/)?.[1];
  if (ph === "research") return "Researching the web";
  if (ph === "draft") return /draft B$/.test(label) ? "Writing a second version" : "Writing";
  if (ph === "revise") return `Improving after review${round && round !== "1" ? ` (round ${round})` : ""}`;
  if (ph === "review") return /review B$/.test(label) ? "Reviewing the second version" : round && round !== "1" ? `Expert review (round ${round})` : "Expert review";
  return label;
}

const AGENT_WHO: Record<string, string> = {
  "Read your website": "Reading your website",
  "Understand the business": "Pulling out the facts",
  "Business insights": "Customers and competitors",
  "Channel scoring": "Ranking channels",
  "Growth plays": "Choosing growth plays",
  "Growth plan": "The 90-day plan",
  "Find customers": "Finding companies",
  "Find creators": "Finding creators",
  "First take": "Quick first take",
  "Write the emails": "Writing the emails",
};

type Phase = { label: string; name: string; status: StepStatus; startedAt: number | null; finishedAt: number | null; findings: string[] };
type Group = { key: string; title: string; status: StepStatus; phases: Phase[] };

/** Steps (done, running and still planned) grouped by agent, in order. */
function groupSteps(run: RunStatusView): Group[] {
  const work = run.steps.filter((x) => x.kind !== "compute");
  const seen = new Set(work.map((x) => x.label));
  const all = [
    ...work.map((x) => ({ label: x.label, status: stepStatus(x.status), startedAt: x.startedAt, finishedAt: x.finishedAt, findings: x.findings })),
    ...run.planned.filter((l) => !seen.has(l)).map((l) => ({ label: l, status: "pending" as StepStatus, startedAt: null, finishedAt: null, findings: [] as string[] })),
  ];
  const groups: Group[] = [];
  for (const x of all) {
    const agent = x.label.includes(": ") ? x.label.split(": ")[0] : x.label;
    let g = groups.find((y) => y.key === agent);
    if (!g) {
      g = { key: agent, title: AGENT_WHO[agent] ?? agent, status: "pending", phases: [] };
      groups.push(g);
    }
    g.phases.push({ ...x, name: x.label.includes(": ") ? phaseName(x.label) : AGENT_WHO[x.label] ?? x.label });
  }
  // Real order: when each agent started; agents not started yet follow the plan.
  const startOf = (g: Group) => Math.min(...g.phases.map((p) => p.startedAt ?? Number.POSITIVE_INFINITY));
  const planIndex = (g: Group) => {
    const i = run.planned.findIndex((l) => l.startsWith(`${g.key}:`) || l === g.key);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };
  groups.sort((a, b) => startOf(a) - startOf(b) || planIndex(a) - planIndex(b));
  for (const g of groups) {
    const st = g.phases.map((p) => p.status);
    g.status = st.includes("failed") ? "failed" : st.includes("running") ? "running" : st.every((v) => v === "done") ? "done" : st.some((v) => v === "done") ? "running" : "pending";
  }
  return groups;
}

/** Re-render every second with the current time (null during the server render). */
function useTicker(ms = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, ms);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ms]);
  return now;
}

const dot = (status: StepStatus) =>
  cn("size-2 shrink-0 rounded-full", status === "done" ? "bg-brand-700" : status === "running" ? "animate-soft-pulse bg-sun" : status === "failed" ? "bg-red-800" : "bg-line-strong");

/**
 * Live progress for an AI job: overall bar with time left, each agent and its
 * phases with timers, and what each finished phase found or decided.
 */
export function RunProgress({
  slug,
  runId,
  done,
  headingLevel: H = "h3",
}: {
  slug: string;
  runId: Id<"workflowRuns">;
  /** Extra content once the run finished successfully (e.g. a link to the drafts). */
  done?: ReactNode;
  headingLevel?: "h2" | "h3" | "h4";
}) {
  const run = useQuery(api.content.runStatus, { slug, runId });
  const now = useTicker();
  if (run === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <span className="sr-only" role="status">
          Loading progress…
        </span>
      </div>
    );
  }
  const label = RUN_STATUS_LABEL[run.status] ?? run.status;
  const finished = RUN_FINISHED.has(run.status);
  const groups = groupSteps(run);
  const running = groups.flatMap((g) => g.phases).find((p) => p.status === "running");
  // A finished run's clock stops when it finished.
  const clock = finished && run.finishedAt ? run.finishedAt : now;
  const progress = clock ? progressOfRun(run.steps.filter((x) => x.kind !== "compute"), run.planned, clock, finished) : null;
  const announce = finished ? `${run.title}: ${label}.` : `${run.title}: ${label}${running ? `, ${running.name}` : ""}.`;
  const timer = (p: { startedAt: number | null; finishedAt: number | null; status: StepStatus }) =>
    p.startedAt && clock ? formatDuration(((p.status === "running" && !finished ? clock : (p.finishedAt ?? clock)) - p.startedAt) / 1000) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <H className="heading-card">{run.title}</H>
        <span className="flex flex-wrap gap-2">
          {run.isFixture ? <Badge tone="violet">Demo: simulated</Badge> : null}
          <Badge tone={RUN_STATUS_TONE[run.status] ?? "neutral"}>{label}</Badge>
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      {progress ? (
        <div>
          <Progress value={progress.percent} label={`${run.title} progress`} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-ink">{finished ? "Finished" : `${progress.percent}% · ${formatEta(progress.etaSeconds)}`}</span>
            <span className="tabular-nums text-ink-3">{formatDuration(progress.elapsedSeconds)} {finished ? "total" : "elapsed"}</span>
          </div>
        </div>
      ) : null}
      {run.preview && !finished ? <EarlyPreview preview={run.preview} /> : null}
      {groups.length ? (
        <ol className="flex flex-col gap-4">
          {groups.map((g) => (
            <li key={g.key} aria-current={g.status === "running" ? "step" : undefined}>
              <p className="flex items-center gap-2">
                <span aria-hidden className={dot(g.status)} />
                <span className={cn("text-ui", g.status === "pending" ? "text-ink-3" : "font-medium text-ink")}>{g.title}</span>
                <span className="sr-only">{g.status === "done" ? "Done" : g.status === "running" ? "In progress" : g.status === "failed" ? "Failed" : "Waiting"}</span>
              </p>
              {g.phases.length > 1 || g.phases[0]?.findings.length || g.phases[0]?.status === "running" ? (
                <ol className="ml-[3px] mt-1.5 flex flex-col gap-1.5 border-l border-line pl-4">
                  {g.phases.map((p) => (
                    <li key={p.label} className="text-sm">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className={dot(p.status)} />
                        <span className={cn(p.status === "pending" ? "text-ink-3" : "text-ink-2", p.status === "running" && "font-medium text-ink")}>{g.phases.length > 1 ? p.name : p.status === "running" ? "Working…" : "Done"}</span>
                        {timer(p) ? <span className="ml-auto tabular-nums text-xs text-ink-3">{timer(p)}</span> : null}
                      </span>
                      {p.findings.map((f) => (
                        <span key={f} className="ml-4 mt-0.5 block text-xs text-ink-3">
                          {f}
                        </span>
                      ))}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-3">Starting…</p>
      )}
      <p className="text-sm text-ink-3">
        {finished
          ? `Used ${microsToCreditsLabel(run.actualMicros)} of ${microsToCreditsLabel(run.estimateMicros)} reserved. Rest returned.`
          : `Up to ${microsToCreditsLabel(run.estimateMicros)} reserved; unused returned.`}
      </p>
      {run.status === "verified" || run.status === "needs_approval" ? done : null}
      {run.status === "failed" || run.status === "canceled" || run.status === "uncertain" ? (
        <Callout tone={run.status === "failed" ? "danger" : "warning"} live="none" title={label}>
          <MessageText text={run.userMessage ?? (run.status === "canceled" ? "Canceled before it finished." : "Couldn't finish. Unused credits returned.")} />
          {run.canRetry ? <RetryRun slug={slug} runId={runId} className="mt-3" /> : null}
        </Callout>
      ) : run.userMessage && run.status !== "verified" ? (
        <MessageText text={run.userMessage} className="text-sm text-ink-2" />
      ) : null}
    </div>
  );
}

/** Continue a stopped job from its last finished step (finished steps aren't redone or recharged). */
export function RetryRun({ slug, runId, className }: { slug: string; runId: Id<"workflowRuns">; className?: string }) {
  const retry = useMutation(api.workspace.retryRun);
  const member = useWorkspaceMember(slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Retrying spends credits: only people who can edit see it.
  if (!member?.role || !can(member.role, "edit")) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        size="sm"
        className="self-start"
        loading={busy}
        loadingText="Continuing…"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await retry({ slug, runId });
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Retry
      </Button>
      <span className="text-xs text-ink-3">Keeps finished steps.</span>
      {error ? (
        <span role="alert" className="text-xs text-red-800">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** The Retry button for a run shown outside RunProgress, only when it can continue. */
export function RetryRunIfPossible({ slug, runId, className }: { slug: string; runId: Id<"workflowRuns">; className?: string }) {
  const run = useQuery(api.content.runStatus, { slug, runId });
  return run?.canRetry ? <RetryRun slug={slug} runId={runId} className={className} /> : null;
}

/**
 * Compact live progress for tight spaces (wish cards, popovers, rows): a slim
 * bar with % and time left, the current agent and phase, the latest finding,
 * and "Show all steps" to open the full panel inline.
 */
export function RunProgressCompact({ slug, runId, className }: { slug: string; runId: Id<"workflowRuns">; className?: string }) {
  const run = useQuery(api.content.runStatus, { slug, runId });
  const now = useTicker();
  const [open, setOpen] = useState(false);
  if (run === undefined) return <Skeleton className={cn("h-8 w-full", className)} />;
  const finished = RUN_FINISHED.has(run.status);
  const groups = groupSteps(run);
  const current = groups.find((g) => g.status === "running") ?? groups.find((g) => g.status === "pending");
  const phase = current?.phases.find((p) => p.status === "running") ?? current?.phases.find((p) => p.status === "pending");
  const latest = [...run.steps].reverse().find((s) => s.findings.length)?.findings[0];
  const progress = now ? progressOfRun(run.steps.filter((x) => x.kind !== "compute"), run.planned, now, finished) : null;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {progress ? <Progress value={progress.percent} label={`${run.title} progress`} /> : <Skeleton className="h-2 w-full" />}
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="min-w-0 truncate font-medium text-brand-800">
          {finished ? (RUN_STATUS_LABEL[run.status] ?? run.status) : current ? `${current.title}${phase && current.phases.length > 1 ? ` · ${phase.name}` : ""}` : "Starting…"}
        </span>
        {progress && !finished ? <span className="shrink-0 tabular-nums text-ink-3">{progress.percent}% · {formatEta(progress.etaSeconds).replace("About ", "~")}</span> : null}
      </p>
      {latest ? <p className="truncate text-xs text-ink-3">Latest: {latest}</p> : null}
      {run.canRetry ? <RetryRun slug={slug} runId={runId} /> : null}
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="self-start text-xs font-medium text-brand-800 hover:underline">
        {open ? "Hide steps" : "All steps"}
      </button>
      {open ? (
        <div className="mt-1 rounded-lg border border-line bg-surface p-3">
          <RunProgress slug={slug} runId={runId} headingLevel="h4" />
        </div>
      ) : null}
    </div>
  );
}


/** What the job already knows, shown while it keeps working: channels that fit, the first take, the chosen plays. */
function EarlyPreview({ preview, finished = false, researchComplete = true }: { preview: RunPreviewData; finished?: boolean; researchComplete?: boolean }) {
  const KIND: Record<string, string> = { bankable: "Practical · established practice", creative: "Adjacent · evidence-supported inference", moonshot: "Bold · speculative hypothesis" };
  return (
    <section aria-label="Early preview" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-3">
      <p className="text-overline text-brand-800">{finished ? researchComplete ? "First take · preliminary, based on available evidence" : "Partial first take · some research did not finish" : "Early preview · more research coming"}</p>
      {preview.plays?.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-ink-2">Chosen plays</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {preview.plays.map((p) => (
              <li key={p.name} className="flex flex-col gap-0.5 rounded-[var(--radius-control)] bg-surface px-2.5 py-2">
                <span className="text-2xs font-medium uppercase tracking-wide text-ink-3">{KIND[p.kind] ?? p.kind}</span>
                <span className="text-ui font-medium text-ink">{p.name}</span>
                <span className="text-xs text-ink-2">
                  <span className="font-semibold tabular-nums text-ink">~{p.p50}</span> {p.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.headline ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-ink">{preview.headline}</p>
          {preview.opportunities?.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {preview.opportunities.map((opportunity, index) => (
                <li key={`${opportunity.title}-${index}`} className="flex flex-col gap-1 rounded-[var(--radius-control)] bg-surface px-2.5 py-2">
                  <p className="text-ui font-medium text-ink">{opportunity.title}</p>
                  {opportunity.why ? <p className="text-xs text-ink-2">{opportunity.why}</p> : null}
                  {opportunity.nextStep ? <p className="text-xs text-ink"><span className="font-medium">First step:</span> {opportunity.nextStep}</p> : null}
                  {opportunity.evidence.length ? (
                    <div className="mt-1 border-t border-line pt-1.5">
                      <p className="text-2xs font-medium uppercase tracking-wide text-ink-3">What this is based on</p>
                      <ul className="mt-1 flex flex-col gap-1 text-2xs text-ink-2">
                        {opportunity.evidence.map((fact, evidenceIndex) => (
                          <li key={fact.factId ?? `${fact.sourceUrl ?? "source"}-${evidenceIndex}`}>
                            <span className="font-medium">{fact.provenance === "source_reported" ? "The website says · check this: " : "Confirmed input: "}</span>
                            {fact.statement}
                            {fact.provenance === "source_reported" && fact.sourceUrl ? <> <a className="underline underline-offset-2" href={fact.sourceUrl} target="_blank" rel="noreferrer">View page</a></> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : <p className="mt-1 text-2xs text-ink-3">Hypothesis · no supporting fact or page linked yet</p>}
                </li>
              ))}
            </ul>
          ) : preview.points?.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
              {preview.points.map((p) => (
                <li key={p}>
                  <Highlight text={p} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {preview.channels?.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-ink-2">Channels that fit</p>
          <ul className="flex flex-wrap gap-1.5">
            {preview.channels.map((c, i) => (
              <li key={c} className="inline-flex items-center gap-1 rounded-[var(--radius-badge)] bg-surface px-2 py-0.5 text-xs text-ink">
                <span className="tabular-nums text-ink-3">{i + 1}</span> {c}
              </li>
            ))}
          </ul>
          {preview.budget ? <p className="text-xs text-ink-3">{preview.budget}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
