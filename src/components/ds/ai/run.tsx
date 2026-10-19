"use client";

/*
 * AI runs: execution timeline, task queue, agent status, reasoning summary,
 * confidence indicator and execution logs. Everything shows live progress:
 * a bar, time left, every step and what it found.
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Hourglass,
  Loader2,
  Pause,
  Play,
  X,
} from "@/components/icons";
import { Badge, Button, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AIMark, AIPanel, CreditCost, LiveProgress, MODELS, type ModelTier } from "./shared";

/* ------------------------------------------------------------------ */
/* Step status                                                         */
/* ------------------------------------------------------------------ */

export type StepStatus = "done" | "running" | "queued" | "waiting" | "failed" | "skipped";

const STEP_TEXT: Record<StepStatus, string> = {
  done: "Done",
  running: "Running",
  queued: "Queued",
  waiting: "Waiting for you",
  failed: "Failed",
  skipped: "Skipped",
};

export function StepIcon({ status, className }: { status: StepStatus; className?: string }) {
  const base = "grid size-5 shrink-0 place-items-center rounded-full [&_svg]:size-3";
  if (status === "done")
    return (
      <span aria-hidden className={cn(base, "bg-ink text-white", className)}>
        <Check strokeWidth={3} />
      </span>
    );
  if (status === "running")
    return (
      <span aria-hidden className={cn(base, "bg-surface text-ink ring-1 ring-ink [&_svg]:size-3.5", className)}>
        <Loader2 className="animate-spin motion-reduce:animate-none" />
      </span>
    );
  if (status === "failed")
    return (
      <span aria-hidden className={cn(base, "bg-red-100 text-red-800", className)}>
        <X strokeWidth={3} />
      </span>
    );
  if (status === "waiting")
    return (
      <span aria-hidden className={cn(base, "bg-amber-100 text-amber-800", className)}>
        <Hourglass />
      </span>
    );
  return <span aria-hidden className={cn(base, "border-[1.5px] border-dashed border-line-strong bg-surface", status === "skipped" && "border-solid bg-surface-2", className)} />;
}

/* ------------------------------------------------------------------ */
/* Execution timeline                                                  */
/* ------------------------------------------------------------------ */

export interface TimelineStep {
  id: string;
  label: string;
  status: StepStatus;
  /** Elapsed or final time, e.g. "4.2s". */
  time?: string;
  model?: ModelTier;
  findings?: string[];
}

export interface AIExecutionTimelineProps {
  title: string;
  steps: TimelineStep[];
  /** 0–100 */
  progress: number;
  secondsLeft?: number;
  credits?: number;
  actions?: ReactNode;
  className?: string;
}

export function AIExecutionTimeline({ title, steps, progress, secondsLeft, credits, actions, className }: AIExecutionTimelineProps) {
  const running = steps.find((s) => s.status === "running");
  return (
    <AIPanel className={cn("flex flex-col gap-4 p-[var(--card-p)]", className)} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AIMark />
          <div>
            <h3 className="heading-card">{title}</h3>
            <p className="text-xs text-ink-3" aria-live="polite">
              {running ? `Now: ${running.label}` : progress >= 100 ? "Finished" : "Not started"}
              {credits !== undefined ? ` · ${credits} credits so far` : ""}
            </p>
          </div>
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
      <LiveProgress label="Progress" value={progress} secondsLeft={secondsLeft} />
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 ? <span aria-hidden className={cn("absolute left-[9.5px] top-6 bottom-1 w-px", s.status === "done" ? "bg-ink" : "bg-line-strong")} /> : null}
            <StepIcon status={s.status} className="mt-px" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={cn("text-ui", s.status === "queued" || s.status === "skipped" ? "text-ink-3" : "font-medium text-ink")}>
                  {s.label}
                  <span className="sr-only">: {STEP_TEXT[s.status]}</span>
                </p>
                <span className="flex items-center gap-2 text-2xs tabular-nums text-ink-3">
                  {s.model ? <span>{MODELS[s.model].name}</span> : null}
                  {s.status === "waiting" ? <span className="font-medium text-amber-800">Waiting for you</span> : s.status === "failed" ? <span className="font-medium text-red-800">Failed</span> : null}
                  {s.time ? <span>{s.time}</span> : null}
                </span>
              </div>
              {s.findings?.length ? (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {s.findings.map((f) => (
                    <li key={f} className="animate-fade-in text-xs text-ink-2 motion-reduce:animate-none">
                      <span aria-hidden className="mr-1.5 text-ink-3">↳</span>
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Task queue                                                          */
/* ------------------------------------------------------------------ */

export interface QueueTask {
  id: string;
  title: string;
  agent: string;
  model: ModelTier;
  credits: number;
  eta: string;
  status: "running" | "queued" | "paused";
  progress?: number;
}

export function AITaskQueue({ initial, className }: { initial: QueueTask[]; className?: string }) {
  const [tasks, setTasks] = useState(initial);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= tasks.length) return;
    const next = [...tasks];
    [next[i], next[j]] = [next[j], next[i]];
    setTasks(next);
  };
  const setStatus = (id: string, status: QueueTask["status"]) => setTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
  const total = tasks.reduce((s, t) => s + t.credits, 0);
  return (
    <AIPanel className={cn("overflow-hidden", className)} aria-label="AI task queue">
      <div className="flex items-center justify-between gap-3 border-b border-line px-[var(--card-p)] py-3">
        <h3 className="heading-card">Queue</h3>
        <span className="text-xs text-ink-3 tabular-nums">
          {tasks.length} tasks · {total} credits
        </span>
      </div>
      <ol className="divide-y divide-line">
        {tasks.map((t, i) => (
          <li key={t.id} className="flex min-h-[var(--cell-h)] flex-wrap items-center gap-x-3 gap-y-2 px-[var(--card-p)] py-2">
            <span className="w-4 text-xs tabular-nums text-ink-3">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui font-medium text-ink">{t.title}</p>
              <p className="text-2xs text-ink-3">
                {t.agent} · {MODELS[t.model].name} · {t.status === "running" ? `${t.eta} left` : t.status === "paused" ? "Paused" : `Starts in ${t.eta}`}
              </p>
              {t.status === "running" && t.progress !== undefined ? (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={`${t.title} progress`} aria-valuenow={t.progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-ink" style={{ width: `${t.progress}%` }} />
                </div>
              ) : null}
            </div>
            <CreditCost credits={t.credits} />
            <div className="flex items-center">
              <IconButton size="sm" aria-label={`Move ${t.title} up`} icon={<ArrowUp className="size-4" />} disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton size="sm" aria-label={`Move ${t.title} down`} icon={<ArrowDown className="size-4" />} disabled={i === tasks.length - 1} onClick={() => move(i, 1)} />
              {t.status === "paused" ? (
                <IconButton size="sm" aria-label={`Resume ${t.title}`} icon={<Play className="size-4" />} onClick={() => setStatus(t.id, "queued")} />
              ) : (
                <IconButton size="sm" aria-label={`Pause ${t.title}`} icon={<Pause className="size-4" />} onClick={() => setStatus(t.id, "paused")} />
              )}
              <IconButton size="sm" aria-label={`Cancel ${t.title}`} icon={<X className="size-4" />} onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))} />
            </div>
          </li>
        ))}
        {tasks.length === 0 ? <li className="px-[var(--card-p)] py-6 text-center text-ui text-ink-3">Queue is empty.</li> : null}
      </ol>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Agent status                                                        */
/* ------------------------------------------------------------------ */

export type AgentState = "working" | "idle" | "waiting" | "paused" | "error";

const AGENT_STATE: Record<AgentState, { text: string; dot: string; tone: "green" | "neutral" | "amber" | "red" }> = {
  working: { text: "Working", dot: "bg-green-800", tone: "green" },
  idle: { text: "Idle", dot: "bg-ink-3", tone: "neutral" },
  waiting: { text: "Needs you", dot: "bg-amber-800", tone: "amber" },
  paused: { text: "Paused", dot: "bg-ink-3", tone: "neutral" },
  error: { text: "Stopped", dot: "bg-red-800", tone: "red" },
};

export function AgentStateBadge({ state }: { state: AgentState }) {
  const s = AGENT_STATE[state];
  return (
    <Badge tone={s.tone}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className={cn("size-1.5 rounded-full", s.dot, state === "working" && "animate-soft-pulse motion-reduce:animate-none")} />
        {s.text}
      </span>
    </Badge>
  );
}

export interface AIAgentStatusProps {
  name: string;
  role: string;
  state: AgentState;
  task?: string;
  progress?: number;
  secondsLeft?: number;
  lastAction?: string;
  onToggle?: () => void;
  className?: string;
}

export function AIAgentStatus({ name, role, state, task, progress, secondsLeft, lastAction, onToggle, className }: AIAgentStatusProps) {
  return (
    <AIPanel className={cn("flex flex-col gap-3 p-[var(--card-p)]", className)} aria-label={`${name} status`}>
      <div className="flex items-start gap-2.5">
        <AIMark />
        <div className="min-w-0 flex-1">
          <p className="text-ui font-semibold text-ink">{name}</p>
          <p className="text-xs text-ink-3">{role}</p>
        </div>
        <AgentStateBadge state={state} />
      </div>
      {task ? <p className="text-ui text-ink-2">{task}</p> : null}
      {state === "working" && progress !== undefined ? <LiveProgress label="This task" value={progress} secondsLeft={secondsLeft} /> : null}
      <div className="flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-3">
        <span>{lastAction}</span>
        {onToggle ? (
          <Button size="sm" variant="secondary" onClick={onToggle}>
            {state === "paused" ? <Play aria-hidden /> : <Pause aria-hidden />}
            {state === "paused" ? "Resume" : "Pause"}
          </Button>
        ) : null}
      </div>
    </AIPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Reasoning summary                                                   */
/* ------------------------------------------------------------------ */

export function AIReasoningSummary({ summary, points, meta, defaultOpen = false, className }: { summary: string; points: string[]; meta?: string; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn("rounded-[var(--radius-card)] border border-line bg-surface-2/60", className)}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 rounded-[var(--radius-card)] px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:outline-none">
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200 motion-reduce:transition-none", !open && "-rotate-90")} />
        <span className="text-ui font-medium text-ink">Why ClimbOS suggests this</span>
        {meta ? <span className="ml-auto text-2xs text-ink-3">{meta}</span> : null}
      </button>
      <div id={id} hidden={!open} className="px-3 pb-3 pl-9">
        <p className="text-voice">{summary}</p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-ui text-ink-2 marker:text-ink-3">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confidence indicator                                                */
/* ------------------------------------------------------------------ */

export function confidenceLevel(v: number) {
  return v >= 0.75 ? "High" : v >= 0.5 ? "Medium" : "Low";
}

export function AIConfidence({ value, variant = "bar", className }: { value: number; variant?: "bar" | "inline"; className?: string }) {
  const level = confidenceLevel(value);
  const pct = Math.round(value * 100);
  const filled = Math.max(1, Math.round(value * 5));
  const fill = level === "High" ? "bg-ink" : level === "Medium" ? "bg-chart-5" : "bg-red-800";
  const segs = (
    <span aria-hidden className="inline-flex gap-[2px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={cn("h-2 w-2.5 rounded-[1px]", i < filled ? fill : "bg-surface-3")} />
      ))}
    </span>
  );
  if (variant === "inline")
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-2", className)} role="img" aria-label={`Confidence ${level.toLowerCase()}, ${pct}%`}>
        {segs}
        {level}
      </span>
    );
  return (
    <div className={cn("flex flex-col gap-1", className)} role="meter" aria-label="Confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${level}, ${pct}%`}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-ink-3">Confidence</span>
        <span className={cn("font-medium tabular-nums", level === "Low" ? "text-red-800" : level === "Medium" ? "text-amber-800" : "text-ink")}>
          {level} · {pct}%
        </span>
      </div>
      <span className="flex gap-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-[1px]", i < filled ? fill : "bg-surface-3")} />
        ))}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Execution logs                                                      */
/* ------------------------------------------------------------------ */

export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogLine {
  t: string;
  level: LogLevel;
  source: string;
  msg: string;
}

const LEVEL_CLS: Record<LogLevel, string> = {
  debug: "text-white/50",
  info: "text-lime",
  warn: "text-amber-500",
  error: "text-red-500",
};

export function AIExecutionLogs({ lines, className }: { lines: LogLine[]; className?: string }) {
  const [levels, setLevels] = useState<Record<LogLevel, boolean>>({ debug: false, info: true, warn: true, error: true });
  const [copied, setCopied] = useState(false);
  const shown = useMemo(() => lines.filter((l) => levels[l.level]), [lines, levels]);
  const counts = useMemo(() => lines.reduce((acc, l) => ({ ...acc, [l.level]: (acc[l.level] ?? 0) + 1 }), {} as Partial<Record<LogLevel, number>>), [lines]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown.map((l) => `${l.t} ${l.level.toUpperCase()} [${l.source}] ${l.msg}`).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] bg-ink text-white", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="mr-auto text-xs font-medium">Run log</span>
        {(["debug", "info", "warn", "error"] as LogLevel[]).map((lv) => (
          <button
            key={lv}
            type="button"
            aria-pressed={levels[lv]}
            onClick={() => setLevels({ ...levels, [lv]: !levels[lv] })}
            className={cn("h-6 rounded-[var(--radius-badge)] px-2 font-mono text-2xs uppercase transition-colors focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none", levels[lv] ? "bg-white/15 text-white" : "text-white/50 hover:text-white")}
          >
            {lv} {counts[lv] ?? 0}
          </button>
        ))}
        <button type="button" onClick={copy} className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-badge)] px-2 text-2xs text-white/80 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none">
          {copied ? <Check aria-hidden className="size-3" /> : <Copy aria-hidden className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div role="log" aria-label="Run log" tabIndex={0} className="max-h-64 overflow-auto p-3 font-mono text-[12px] leading-5 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none">
        {shown.map((l, i) => (
          <div key={`${l.t}-${i}`} className="flex gap-3 whitespace-pre">
            <span className="text-white/45">{l.t}</span>
            <span className={cn("w-11 shrink-0 uppercase", LEVEL_CLS[l.level])}>{l.level}</span>
            <span className="text-white/60">[{l.source}]</span>
            <span className={l.level === "error" ? "text-red-500" : "text-white/90"}>{l.msg}</span>
          </div>
        ))}
        {shown.length === 0 ? <p className="text-white/50">No lines at these levels.</p> : null}
      </div>
    </div>
  );
}
