"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, CircleCheck, Clock, Plus, X } from "@/components/icons";
import { Button, ProgressRing } from "@/components/ui";
import { StepProgress } from "@/components/ds/feedback";
import { cn } from "@/lib/utils";

/** Arrow-key support for button-based radio groups (roving focus). */
function radioNav(e: KeyboardEvent<HTMLElement>, values: string[], current: string | null, onChange: (v: string) => void) {
  const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const i = current ? values.indexOf(current) : -1;
  const n = (i + d + values.length) % values.length;
  onChange(values[n]);
  e.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]')[n]?.focus();
}

const rovingTab = (values: string[], current: string | null, v: string) => (current ? (current === v ? 0 : -1) : values[0] === v ? 0 : -1);

/* ------------------------------------------------------------------ */
/* Welcome screen                                                      */
/* ------------------------------------------------------------------ */

export interface WelcomeChoice {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface WelcomeScreenProps {
  name: string;
  /** Reckless voice line under the greeting. */
  intro: ReactNode;
  question: string;
  choices: WelcomeChoice[];
  value: string | null;
  onChange: (v: string) => void;
  onStart: () => void;
  onSkip?: () => void;
  /** What happens after Start, with rough timings. */
  next: { label: string; time: string }[];
  className?: string;
}

/** First screen after sign-up: greeting, one question, what happens next. */
export function WelcomeScreen({ name, intro, question, choices, value, onChange, onStart, onSkip, next, className }: WelcomeScreenProps) {
  const qid = useId();
  return (
    <section aria-labelledby={`${qid}-h`} className={cn("grid overflow-hidden rounded-[8px] border border-line bg-surface shadow-[var(--card-shadow)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]", className)}>
      <div className="flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-overline">Welcome to ClimbOS</p>
          <h2 id={`${qid}-h`} className="heading-page">Hi {name}, let&apos;s get you customers.</h2>
          <div className="text-voice max-w-xl text-ink-2">{intro}</div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend id={qid} className="mb-2 text-ui font-medium text-ink">
            {question}
          </legend>
          <div role="radiogroup" aria-labelledby={qid} className="grid gap-2 sm:grid-cols-2">
            {choices.map((c) => {
              const on = value === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={rovingTab(choices.map((x) => x.value), value, c.value)}
                  onKeyDown={(e) => radioNav(e, choices.map((x) => x.value), value, onChange)}
                  onClick={() => onChange(c.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-[var(--radius-card)] border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] [&_svg]:size-4",
                    on ? "border-ink bg-surface ring-1 ring-ink" : "border-line-strong bg-surface hover:bg-surface-2",
                  )}
                >
                  {c.icon ? <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)]", on ? "bg-ink text-white" : "bg-surface-2 text-ink-2")}>{c.icon}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block text-ui font-medium text-ink">{c.label}</span>
                    {c.description ? <span className="block text-xs text-ink-3">{c.description}</span> : null}
                  </span>
                  <span aria-hidden="true" className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]", on ? "border-ink bg-ink text-white" : "border-control")}>
                    {on ? <Check className="size-2.5" strokeWidth={3} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" variant="accent" disabled={!value} onClick={onStart}>
            Build my plan <ArrowRight aria-hidden="true" />
          </Button>
          {onSkip ? (
            <Button size="lg" variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          ) : null}
        </div>
      </div>
      <aside className="flex flex-col gap-4 border-t border-line bg-cream p-6 sm:p-8 lg:border-l lg:border-t-0">
        <p className="heading-card">What happens next</p>
        <ol className="flex flex-col gap-3">
          {next.map((n, i) => (
            <li key={n.label} className="flex items-start gap-3">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-2xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-ui text-ink">{n.label}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-2">
                <Clock aria-hidden="true" className="size-3.5" />
                {n.time}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-trust mt-auto">No card needed. 50 free credits to start.</p>
      </aside>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Setup wizard                                                        */
/* ------------------------------------------------------------------ */

export interface WizardStep {
  key: string;
  /** Short name for the step bar. */
  label: string;
  title: ReactNode;
  description?: ReactNode;
  content: ReactNode;
  /** False disables Next (e.g. a required field is empty). */
  canContinue?: boolean;
  /** Optional steps get a Skip button. */
  optional?: boolean;
}

export interface SetupWizardProps {
  steps: WizardStep[];
  step: number;
  onStepChange: (i: number) => void;
  onFinish: () => void;
  finishLabel?: string;
  busy?: boolean;
  className?: string;
}

/** Multi-step setup in one panel: step bar, one question per screen, Back / Next. */
export function SetupWizard({ steps, step, onStepChange, onFinish, finishLabel = "Finish setup", busy, className }: SetupWizardProps) {
  const s = steps[step];
  const last = step === steps.length - 1;
  return (
    <section aria-label="Setup" className={cn("flex flex-col rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <div className="relative overflow-x-auto border-b border-line px-4 py-4">
        <StepProgress steps={steps.map((x) => x.label)} current={step} onStepClick={onStepChange} className="min-w-[420px]" />
      </div>
      <div key={s.key} className="flex flex-col gap-4 p-[var(--card-p)] sm:p-6 animate-step-in">
        <div>
          <p className="text-xs text-ink-3">
            Step {step + 1} of {steps.length}
            {s.optional ? " · Optional" : ""}
          </p>
          <h3 className="heading-section mt-1">{s.title}</h3>
          {s.description ? <p className="mt-1 text-sm text-ink-2">{s.description}</p> : null}
        </div>
        <div>{s.content}</div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line px-[var(--card-p)] py-3 sm:px-6">
        <Button variant="ghost" disabled={step === 0 || busy} onClick={() => onStepChange(step - 1)}>
          Back
        </Button>
        <span className="ml-auto flex gap-2">
          {s.optional && !last ? (
            <Button variant="ghost" onClick={() => onStepChange(step + 1)}>
              Skip
            </Button>
          ) : null}
          <Button disabled={s.canContinue === false} loading={busy} onClick={() => (last ? onFinish() : onStepChange(step + 1))}>
            {last ? finishLabel : "Continue"}
            {!last ? <ArrowRight aria-hidden="true" /> : null}
          </Button>
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Onboarding checklist                                                */
/* ------------------------------------------------------------------ */

export interface ChecklistItem {
  id: string;
  title: string;
  description?: ReactNode;
  done: boolean;
  /** e.g. "2 min" */
  time?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface OnboardingChecklistProps {
  title?: string;
  items: ChecklistItem[];
  onToggle?: (id: string, done: boolean) => void;
  onDismiss?: () => void;
  className?: string;
}

/** Getting-started list with overall progress; the next open task is expanded. */
export function OnboardingChecklist({ title = "Get set up", items, onToggle, onDismiss, className }: OnboardingChecklistProps) {
  const done = items.filter((i) => i.done).length;
  const firstOpen = items.find((i) => !i.done)?.id ?? null;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const open = expanded ?? firstOpen;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const uid = useId();
  return (
    <section aria-labelledby={`${uid}-t`} className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <div className="flex items-start gap-3 p-[var(--card-p)] pb-3">
        <div className="min-w-0 flex-1">
          <h3 id={`${uid}-t`} className="heading-card">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-ink-3">
            <span className="font-semibold tabular-nums text-ink">{done} of {items.length}</span> done{done === items.length ? " · nice work" : ""}
          </p>
        </div>
        <button type="button" aria-expanded={!collapsed} aria-controls={`${uid}-list`} onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand checklist" : "Collapse checklist"} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", collapsed && "-rotate-90")} />
        </button>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} aria-label="Hide checklist" className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="px-[var(--card-p)] pb-3">
        <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul id={`${uid}-list`} hidden={collapsed} className="border-t border-line">
        {items.map((it) => {
          const isOpen = open === it.id;
          return (
            <li key={it.id} className="border-b border-line last:border-b-0">
              <div className="flex items-center gap-3 px-[var(--card-p)] py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={it.done}
                  aria-label={`${it.title}: ${it.done ? "done" : "not done"}`}
                  onClick={() => onToggle?.(it.id, !it.done)}
                  className={cn("grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors", it.done ? "border-green-800 bg-green-800 text-white" : "border-control hover:border-ink")}
                >
                  {it.done ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
                </button>
                <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? "" : it.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={cn("min-w-0 flex-1 truncate text-ui", it.done ? "text-ink-3 line-through" : "font-medium text-ink")}>{it.title}</span>
                  {it.time && !it.done ? <span className="shrink-0 text-xs text-ink-3">{it.time}</span> : null}
                  <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-ink-3 transition-transform", !isOpen && "-rotate-90")} />
                </button>
              </div>
              {isOpen && (it.description || it.onAction) ? (
                <div className="flex flex-col items-start gap-2 pb-3 pl-[calc(var(--card-p)+32px)] pr-[var(--card-p)]">
                  {it.description ? <p className="text-ui text-ink-2">{it.description}</p> : null}
                  {it.onAction && !it.done ? (
                    <Button size="sm" onClick={it.onAction}>
                      {it.actionLabel ?? "Start"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Setup completion                                                    */
/* ------------------------------------------------------------------ */

export interface SetupCompletionProps {
  done: number;
  total: number;
  /** Next task label, e.g. "Connect Instagram". */
  next?: string;
  onNext?: () => void;
  variant?: "card" | "compact";
  className?: string;
}

/** Setup progress at a glance: ring + count + next task; a pill in the sidebar. */
export function SetupCompletion({ done, total, next, onNext, variant = "card", className }: SetupCompletionProps) {
  const complete = done >= total;
  const v = total ? done / total : 0;
  if (variant === "compact") {
    return (
      <button type="button" onClick={onNext} className={cn("flex w-full items-center gap-2.5 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-2 text-left shadow-[var(--card-shadow)] hover:bg-surface-2", className)}>
        {complete ? <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-green-800" /> : <ProgressRing value={v} size={28} label="Setup">{""}</ProgressRing>}
        <span className="min-w-0 flex-1">
          <span className="block text-ui font-medium text-ink">{complete ? "Setup complete" : "Finish setup"}</span>
          <span className="block truncate text-2xs text-ink-3">{complete ? "Autopilot is on" : `${done} of ${total} · ${next ?? ""}`}</span>
        </span>
        {!complete ? <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" /> : null}
      </button>
    );
  }
  return (
    <div className={cn("flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]", className)}>
      <ProgressRing value={v} size={64} label="Setup complete" color={complete ? "var(--green-800)" : "var(--chart-2)"} />
      <div className="min-w-0 flex-1">
        <p className="heading-card">{complete ? "You're all set" : "Setup"}</p>
        <p className="text-ui text-ink-2">{complete ? "Autopilot is running your first plays." : `${done} of ${total} steps done`}</p>
        {!complete && next ? <p className="mt-0.5 text-xs text-ink-3">Next: {next}</p> : null}
      </div>
      {!complete && onNext ? (
        <Button size="sm" onClick={onNext}>
          Continue
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Starter templates                                                   */
/* ------------------------------------------------------------------ */

export interface StarterTemplate {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  /** e.g. "3 posts · 1 email · 7 days" */
  includes: string;
  tag?: string;
}

export interface StarterTemplatesProps {
  templates: StarterTemplate[];
  value: string | null;
  onChange: (id: string) => void;
  onBlank?: () => void;
  label?: string;
  className?: string;
}

/** Pick-one grid of ready-made starting points plus "Start blank". */
export function StarterTemplates({ templates, value, onChange, onBlank, label = "Starter templates", className }: StarterTemplatesProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {templates.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={rovingTab(templates.map((x) => x.id), value, t.id)}
            onKeyDown={(e) => radioNav(e, templates.map((x) => x.id), value, onChange)}
            onClick={() => onChange(t.id)}
            className={cn(
              "group flex flex-col gap-3 rounded-[var(--radius-card)] border bg-surface p-[var(--card-p)] text-left shadow-[var(--card-shadow)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
              on ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <span aria-hidden="true" className={cn("grid size-9 place-items-center rounded-[var(--radius-control)] [&_svg]:size-4", on ? "bg-lime text-ink" : "bg-surface-2 text-ink-2")}>
                {t.icon}
              </span>
              {t.tag ? <span className="rounded-[var(--radius-badge)] bg-cream px-1.5 py-0.5 text-2xs font-medium text-ink-2">{t.tag}</span> : null}
            </span>
            <span>
              <span className="heading-card block">{t.title}</span>
              <span className="mt-1 block text-ui text-ink-2">{t.description}</span>
            </span>
            <span className="mt-auto flex items-center justify-between gap-2 text-xs text-ink-3">
              {t.includes}
              {on ? <CircleCheck aria-hidden="true" className="size-4 text-ink" /> : null}
            </span>
          </button>
        );
      })}
      {onBlank ? (
        <button type="button" onClick={onBlank} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong p-[var(--card-p)] text-ui font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
          <Plus aria-hidden="true" className="size-5" />
          Start blank
        </button>
      ) : null}
    </div>
  );
}
