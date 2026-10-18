"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Callout, Progress, Skeleton, type StepItem, type StepStatus } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDuration, formatEta, phaseOf, progressOfRun } from "../../../../shared/progress";
import { microsToDisplay } from "../money";
import { roleTitle } from "../roles";

export type RunStatusView = FunctionReturnType<typeof api.content.runStatus>;

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
  if (ph === "draft") return "Writing";
  if (ph === "revise") return `Improving after review${round && round !== "1" ? ` (round ${round})` : ""}`;
  if (ph === "review") return round && round !== "1" ? `Expert review (round ${round})` : "Expert review";
  return label;
}

const AGENT_WHO: Record<string, string> = {
  "Read your website": "Reading your website",
  "Understand the business": "AI Data Analyst: pulling out the facts",
  "Business insights": "AI CMO: customers, competitors and positioning",
  "Channel scoring": "AI CMO: ranking acquisition channels",
  "Growth plays": "AI CMO: choosing growth plays",
  "Growth plan": "AI CEO: the 90-day plan",
  "Find customers": "AI Sales: finding companies that need you",
  "Write the emails": "AI Sales: writing the emails",
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
  const progress = now ? progressOfRun(run.steps.filter((x) => x.kind !== "compute"), run.planned, now, finished) : null;
  const announce = finished ? `${run.title}: ${label}.` : `${run.title}: ${label}${running ? `, ${running.name}` : ""}.`;
  const timer = (p: { startedAt: number | null; finishedAt: number | null; status: StepStatus }) =>
    p.startedAt && now ? formatDuration(((p.status === "running" ? now : (p.finishedAt ?? now)) - p.startedAt) / 1000) : null;
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
        <p className="text-sm text-ink-3">Getting the team ready…</p>
      )}
      <p className="text-sm text-ink-3">
        {finished
          ? `Used ${microsToDisplay(run.actualMicros)} of up to ${microsToDisplay(run.estimateMicros)} reserved from your AI capacity.`
          : `Up to ${microsToDisplay(run.estimateMicros)} of AI capacity is reserved for this. Anything unused is returned. You can leave this page; the team keeps working.`}
      </p>
      {run.status === "verified" || run.status === "needs_approval" ? done : null}
      {run.status === "failed" || run.status === "canceled" || run.status === "uncertain" ? (
        <Callout tone={run.status === "failed" ? "danger" : "warning"} live="none" title={label}>
          {run.userMessage ?? (run.status === "canceled" ? "This job was canceled before it finished." : "The team couldn't finish this. Unused capacity was returned.")}
        </Callout>
      ) : run.userMessage && run.status !== "verified" ? (
        <p className="text-sm text-ink-2">{run.userMessage}</p>
      ) : null}
    </div>
  );
}
