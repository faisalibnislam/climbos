"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery } from "convex/react";
import { ArrowRight, ExternalLink, Globe, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Callout, Skeleton } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { StepList, type StepItem } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { normalizeWebsite } from "./website";

const GOALS = ["More customers", "More sales", "More reach", "Something else"] as const;
type GoalChoice = (typeof GOALS)[number];

const SLOW_AFTER_SECONDS = 60;

const DEFAULT_STEPS: StepItem[] = [
  { key: "reading", label: "Reading your website", status: "pending" },
  { key: "understanding", label: "Understanding your business", status: "pending" },
  { key: "planning", label: "Drafting first growth ideas", status: "pending" },
];

const ROLE_NAMES: Record<string, string> = {
  ceo: "AI CEO",
  coo: "AI COO",
  cmo: "AI CMO",
  cso: "AI CSO",
  creative_director: "AI Creative Director",
  social_media_manager: "AI Social Media Manager",
  ads_manager: "AI Ads Manager",
  seo_specialist: "AI SEO Specialist",
  data_analyst: "AI Data Analyst",
  customer_success_manager: "AI Customer Success Manager",
};

function roleName(role: string): string {
  const key = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_NAMES[key] ?? ROLE_NAMES[key.replace(/^ai_/, "")] ?? role;
}

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string; reason?: string }
  | { kind: "tracking"; token: string; website: string };

/**
 * Landing-page "magic moment": enter a website + goal, then watch ClimbOS read
 * the public homepage and draft first ideas in real time (Convex subscription).
 */
export function LivePreview() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [website, setWebsite] = useState("");
  const [goal, setGoal] = useState<GoalChoice>("More customers");
  const [customGoal, setCustomGoal] = useState("");
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const goalGroupId = useId();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const site = normalizeWebsite(website);
    const goalText = goal === "Something else" ? customGoal.trim() : goal;
    setWebsiteError(site.ok ? null : site.message);
    setGoalError(goalText ? null : "Tell us your goal in a few words.");
    if (!site.ok) {
      websiteRef.current?.focus();
      return;
    }
    if (!goalText) return;

    setPhase({ kind: "submitting" });
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: site.value, goal: goalText.slice(0, 300) }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; token: string }
        | { ok: false; reason?: string; message?: string }
        | null;
      if (data && data.ok) {
        setPhase({ kind: "tracking", token: data.token, website: site.value });
        return;
      }
      setPhase({
        kind: "error",
        reason: data?.reason,
        message:
          data?.message ??
          (res.status === 429
            ? "You've used today's free previews. Explore the demo instead."
            : "Live previews aren't available right now. The demo shows the full experience."),
      });
    } catch {
      setPhase({ kind: "error", message: "We couldn't reach ClimbOS. Check your connection and try again." });
    }
  }

  if (phase.kind === "tracking") {
    return (
      <PreviewPanel
        token={phase.token}
        website={phase.website}
        onReset={() => {
          setPhase({ kind: "idle" });
          setTimeout(() => websiteRef.current?.focus(), 0);
        }}
      />
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Get a free preview for your website"
      className="rounded-[22px] border border-line bg-surface p-5 shadow-lg sm:p-7"
    >
      <Field label="Your website" hint="Your homepage address, like formkit.app" error={websiteError ?? undefined}>
        <div className="relative">
          <Globe aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
          <Input
            ref={websiteRef}
            name="website"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="yourbusiness.com"
            value={website}
            maxLength={300}
            onChange={(e) => setWebsite(e.target.value)}
            className="h-14 pl-11 text-[1.0625rem]"
          />
        </div>
      </Field>

      <fieldset className="mt-5" aria-describedby={goalError ? `${goalGroupId}-err` : undefined}>
        <legend className="text-[0.95rem] font-medium text-ink">What do you want most right now?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <label
              key={g}
              className={cn(
                "relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[0.95rem] font-medium transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-green-600",
                goal === g
                  ? "border-green-800 bg-green-800 text-white"
                  : "border-line-strong bg-surface text-ink hover:border-green-700 hover:bg-green-50",
              )}
            >
              <input
                type="radio"
                name="goal"
                value={g}
                checked={goal === g}
                onChange={() => setGoal(g)}
                className="sr-only"
              />
              {goal === g ? <span aria-hidden="true" className="mr-1.5">✓</span> : null}
              {g}
            </label>
          ))}
        </div>
        {goal === "Something else" ? (
          <Field label="Your goal" className="mt-4" error={goalError ?? undefined}>
            <Input
              name="customGoal"
              value={customGoal}
              maxLength={300}
              placeholder="e.g. Fill weekday tables at my café"
              onChange={(e) => setCustomGoal(e.target.value)}
            />
          </Field>
        ) : null}
      </fieldset>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={phase.kind === "submitting"} loadingText="Starting…" className="w-full sm:w-auto">
          Show me
          <ArrowRight aria-hidden="true" />
        </Button>
        <p className="text-sm leading-snug text-ink-3">Free, no sign-up. We only read your public homepage.</p>
      </div>

      {phase.kind === "error" ? (
        <Callout
          tone={phase.reason === "invalid" ? "danger" : "warning"}
          live="alert"
          className="mt-5"
          title={phase.reason === "rate_limited" ? "Previews are taking a breather" : "We couldn't start the preview"}
          action={
            <Link href="/demo" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Try the demo
            </Link>
          }
        >
          {phase.message}
        </Callout>
      ) : null}
    </form>
  );
}

const confidenceTone: Record<string, Tone> = { high: "green", medium: "blue", low: "neutral" };

function PreviewPanel({ token, website, onReset }: { token: string; website: string; onReset: () => void }) {
  const data = useQuery(api.preview.get, { token });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [seconds, setSeconds] = useState(0);
  const finished = data === null || data?.status === "done" || data?.status === "failed";

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [finished]);

  const steps: StepItem[] = data?.steps?.length
    ? data.steps.map((s) => ({ key: s.key, label: s.status === "running" ? `${s.label}…` : s.label, status: s.status }))
    : DEFAULT_STEPS;
  const running = steps.find((s) => s.status === "running");
  const liveMessage =
    data === null
      ? "This preview has expired."
      : data?.status === "done"
        ? "Your preview is ready."
        : data?.status === "failed"
          ? "We couldn't finish this preview."
          : running
            ? `${String(running.label)}`
            : "Getting started…";

  const saveHref = `/sign-in?next=/onboarding%3Fpreview%3D${encodeURIComponent(token)}`;
  const slow = !finished && seconds >= SLOW_AFTER_SECONDS;

  return (
    <section
      aria-labelledby="preview-heading"
      className="rounded-[22px] border border-line bg-surface p-5 shadow-lg animate-fade-in sm:p-7"
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-700">Live preview</p>
          <h2
            id="preview-heading"
            ref={headingRef}
            tabIndex={-1}
            className="mt-0.5 break-words font-display text-2xl font-semibold leading-tight text-ink focus:outline-none"
          >
            {data?.business?.name ?? website}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          Try another website
        </Button>
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-[10px] bg-surface-2 px-3 py-2 text-sm text-ink-2">
        <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green-700" />
        <span>
          <strong className="font-semibold text-ink">Preview</strong> — based only on your public homepage. Nothing is published.
        </span>
      </p>

      {data === undefined ? (
        <div className="mt-6 flex flex-col gap-3" aria-hidden="true">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      ) : data === null ? (
        <Callout tone="warning" className="mt-6" title="This preview has expired" live="status">
          Previews are kept for a few days. Start a new one — it only takes a minute.
        </Callout>
      ) : (
        <>
          {data.status === "queued" ? (
            <p className="mt-5 text-sm text-ink-3 animate-soft-pulse">You&apos;re in line — starting in a moment…</p>
          ) : null}
          {data.status !== "done" ? <StepList steps={steps} className={data.status === "queued" ? "mt-4" : "mt-6"} /> : null}

          {slow ? (
            <Callout
              tone="info"
              live="status"
              className="mt-5"
              title="This is taking longer than usual…"
              action={
                <Link href="/demo" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  Try the full demo
                </Link>
              }
            >
              You can keep waiting — this page updates by itself — or explore the full demo in the meantime.
            </Callout>
          ) : null}

          {data.status === "failed" ? (
            <Callout
              tone="warning"
              live="status"
              className="mt-5"
              title="We couldn't finish this preview"
              action={
                <Link href="/demo" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  Try the demo
                </Link>
              }
            >
              {data.error && data.error.length < 200
                ? data.error
                : "Some websites block automated visitors or load slowly. The demo shows exactly what ClimbOS does."}
            </Callout>
          ) : null}

          {data.business ? (
            <div className="mt-6 rounded-[14px] border border-line bg-bg p-4 animate-step-in">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">What we understood</h3>
              <p className="mt-2 text-[1.0625rem] leading-relaxed text-ink">{data.business.summary}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-ink-3">Who it&apos;s for</dt>
                  <dd className="text-ink">{data.business.audience}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink-3">Category</dt>
                  <dd className="text-ink">{data.business.category}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {data.facts.length > 0 ? (
            <div className="mt-6 animate-step-in">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">What we found on your site</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {data.facts.slice(0, 8).map((f, i) => {
                  const conf = f.confidence.toLowerCase();
                  return (
                    <li key={i} className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-surface px-3.5 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                      <span className="text-[0.95rem] leading-snug text-ink">{f.statement}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={confidenceTone[conf] ?? "neutral"}>
                          {conf === "high" || conf === "medium" || conf === "low" ? `${conf[0].toUpperCase()}${conf.slice(1)} confidence` : f.confidence}
                        </Badge>
                        {f.sourceUrl ? (
                          <a
                            href={f.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-green-800 underline underline-offset-2"
                          >
                            Source
                            <ExternalLink aria-hidden="true" className="size-3.5" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {data.ideas.length > 0 ? (
            <div className="mt-6 animate-step-in">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-3">First growth ideas</h3>
              <ul className="mt-3 grid gap-3">
                {data.ideas.slice(0, 3).map((idea, i) => (
                  <li key={i} className="rounded-[14px] border border-line bg-surface p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="green" icon={<Lightbulb />}>
                        {idea.channel}
                      </Badge>
                      <span className="text-sm text-ink-3">Proposed by {roleName(idea.role)}</span>
                    </div>
                    <h4 className="mt-2 font-semibold leading-snug text-ink">{idea.title}</h4>
                    <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-2">{idea.why}</p>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-ink">
                      <span className="font-medium">First step: </span>
                      {idea.firstStep}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {data?.status === "done" ? (
        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row">
          <Link href={saveHref} className={buttonClasses({ size: "lg", className: "w-full sm:w-auto" })}>
            Save this and build my full plan
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/demo" className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full sm:w-auto" })}>
            Try the full demo
          </Link>
        </div>
      ) : null}
    </section>
  );
}
