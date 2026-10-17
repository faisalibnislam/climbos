"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { CircleCheck, Crosshair, FlaskConical, Gem, Info, Rocket, ShieldCheck, Sparkles, Target, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, CardContent, Tooltip, toast, type Tone } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { cn } from "@/lib/utils";
import { PlanSection } from "./PlanSections";

/** Mirrors shared/agents/specs PlaySchema (stored loosely in Convex). */
export interface PlayView {
  name: string;
  oneLiner: string;
  kind: "bankable" | "creative" | "moonshot";
  audience: { who: string; where: string; size: string };
  trigger: string;
  hook: string;
  mechanic: string;
  assetUsed: string;
  forecast: {
    steps: { step: string; volume: string; low: string; likely: string; high: string; source: string; grade: "A" | "B" | "C" | "D" }[];
    unit: string;
    p10: number;
    p50: number;
    p90: number;
    horizonDays: number;
    confidence: "high" | "medium" | "low";
    biggestUnknown: string;
  };
  test: { size: string; budget: string; durationDays: number; leadingMetric: string; killIf: string; scaleIf: string };
  scores: { fit: number; predictability: number; leverage: number; timeToSignal: number; compounding: number; cost: number; risk: number; distinctiveness: number };
  firstActionToday: string;
  climbosCanDo: string;
}

export interface ExpertView {
  diagnosis: string;
  affordableCac: string;
  notDoing: { channel: string; why: string }[];
  northStar: { metric: string; baseline: string; target: string };
  leadingIndicators: { metric: string; weeklyTarget: string; source: string }[];
  phases: { name: string; days: string; focus: string }[];
  weekOneChecklist: string[];
  risks: { risk: string; mitigation: string }[];
  plays?: PlayView[];
}

const KIND: Record<PlayView["kind"], { label: string; tone: Tone; icon: LucideIcon; hint: string }> = {
  bankable: { label: "Bankable", tone: "green", icon: ShieldCheck, hint: "The most predictable lever: proven here or very close to it." },
  creative: { label: "Creative, proven", tone: "violet", icon: Gem, hint: "A proven mechanic aimed at an audience, asset or moment competitors aren't using." },
  moonshot: { label: "Capped moonshot", tone: "orange", icon: Rocket, hint: "High upside, low predictability: small budget and a hard stop rule." },
};

const GRADE: Record<string, string> = {
  A: "Grade A: large dataset or first-party data",
  B: "Grade B: vendor aggregate or survey with a sample size",
  C: "Grade C: vendor claim or small case study",
  D: "Grade D: assumption; the first test measures it",
};

/** Score out of 100 from the growth-plays weights. */
function score(s: PlayView["scores"]) {
  const c = (n: number) => Math.max(1, Math.min(5, n));
  return Math.round(20 * (0.25 * c(s.fit) + 0.2 * c(s.predictability) + 0.15 * c(s.leverage) + 0.1 * c(s.timeToSignal) + 0.1 * c(s.compounding) + 0.1 * c(s.cost) + 0.1 * c(s.risk)));
}

export function NorthStar({ expert }: { expert: ExpertView }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-overline">Diagnosis</p>
          <p className="text-sm text-ink-2">{expert.diagnosis}</p>
          {expert.affordableCac ? (
            <p className="mt-1 text-ui text-ink-3">
              <span className="font-medium text-ink">Affordable cost per customer: </span>
              {expert.affordableCac}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-overline flex items-center gap-1.5">
            <Target aria-hidden className="size-3.5" /> North Star
          </p>
          <p className="heading-card">{expert.northStar.metric}</p>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-xs text-ink-3">Now</p>
              <p className="text-sm font-medium text-ink-2">{expert.northStar.baseline}</p>
            </div>
            <span aria-hidden className="mb-1.5 h-px flex-1 bg-line-strong" />
            <div className="text-right">
              <p className="text-xs text-ink-3">Target</p>
              <p className="metric text-xl leading-6">{expert.northStar.target}</p>
            </div>
          </div>
          {expert.leadingIndicators.length ? (
            <ul className="mt-1 flex flex-col gap-1 border-t border-line pt-2">
              {expert.leadingIndicators.map((l) => (
                <li key={l.metric} className="flex justify-between gap-3 text-ui">
                  <span className="text-ink-2">{l.metric}</span>
                  <span className="shrink-0 font-medium tabular-nums text-ink">{l.weeklyTarget}/wk</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** P10–P90 range bar with the most-likely marker. */
function ForecastBar({ f }: { f: PlayView["forecast"] }) {
  const max = Math.max(f.p90, 1) * 1.15;
  const pos = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-ui text-ink-3">Expected in {f.horizonDays} days</span>
        <span className="text-ui text-ink-2">
          <span className="metric text-xl leading-6">{f.p50}</span> {f.unit} <span className="text-ink-3">most likely</span>
        </span>
      </div>
      <div className="relative h-6" role="img" aria-label={`Forecast: ${f.p10} to ${f.p90} ${f.unit}, most likely ${f.p50}`}>
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
        <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-200" style={{ left: pos(f.p10), right: `calc(100% - ${pos(f.p90)})` }} />
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand-800" style={{ left: pos(f.p50) }} />
      </div>
      <div className="flex justify-between text-xs text-ink-3">
        <span>Low {f.p10}</span>
        <span className="capitalize">{f.confidence} confidence</span>
        <span>High {f.p90}</span>
      </div>
    </div>
  );
}

function PlayCard({ play, slug }: { play: PlayView; slug: string }) {
  const k = KIND[play.kind] ?? KIND.creative;
  const send = useMutation(api.workspace.sendChat);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const total = score(play.scores);
  return (
    <article className={cn("flex flex-col overflow-hidden rounded-xl border bg-surface", play.kind === "creative" ? "border-violet-500/40" : "border-line")}>
      <header className="flex flex-col gap-2 border-b border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content={k.hint}>
            <span tabIndex={0} className="rounded-md">
              <Badge tone={k.tone} icon={<k.icon />}>
                {k.label}
              </Badge>
            </span>
          </Tooltip>
          <Tooltip content="Weighted score (fit, predictability, leverage, speed, compounding, cost, risk). Distinctiveness is how hard this is for a competitor to copy.">
            <span tabIndex={0} className="ml-auto flex items-center gap-2 rounded-md text-xs text-ink-3">
              Score <span className="font-semibold tabular-nums text-ink">{total}</span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-0.5" aria-label={`Distinctiveness ${play.scores.distinctiveness} of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} aria-hidden className={cn("size-1.5 rounded-full", i <= play.scores.distinctiveness ? "bg-violet-500" : "bg-surface-3")} />
                ))}
              </span>
            </span>
          </Tooltip>
        </div>
        <h3 className="heading-section">{play.name}</h3>
        <p className="text-sm text-ink-2">{play.oneLiner}</p>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <dl className="grid gap-2 text-ui">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-3">Who</dt>
            <dd className="text-ink">
              {play.audience.who}
              {play.audience.where ? <span className="text-ink-3"> · {play.audience.where}</span> : null}
              {play.audience.size ? <span className="text-ink-3"> · {play.audience.size}</span> : null}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-3">Hook</dt>
            <dd className="text-ink">“{play.hook}”</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-3">When</dt>
            <dd className="text-ink">{play.trigger}</dd>
          </div>
          {play.assetUsed ? (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-ink-3">Edge</dt>
              <dd className="text-ink">{play.assetUsed}</dd>
            </div>
          ) : null}
        </dl>

        <ForecastBar f={play.forecast} />

        {open ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-overline">How we estimate it</p>
              <ol className="mt-2 flex flex-col gap-1.5">
                {play.forecast.steps.map((st, i) => (
                  <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg bg-surface-2/70 px-2.5 py-1.5 text-ui">
                    <span className="text-ink">
                      {st.volume ? <span className="font-medium tabular-nums">{st.volume} </span> : null}
                      {st.step}
                      <span className="block text-xs text-ink-3">
                        {st.low}–{st.high}, plan on {st.likely}
                        {st.source ? ` · ${st.source}` : ""}
                      </span>
                    </span>
                    <Tooltip content={GRADE[st.grade]}>
                      <span tabIndex={0} className="grid size-6 place-items-center rounded-md border border-line text-xs font-semibold text-ink-2">
                        {st.grade}
                      </span>
                    </Tooltip>
                  </li>
                ))}
              </ol>
              {play.forecast.biggestUnknown ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-3">
                  <Info aria-hidden className="mt-px size-3.5 shrink-0" /> Biggest unknown: {play.forecast.biggestUnknown}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-line p-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                  <FlaskConical aria-hidden className="size-3.5" /> The test
                </p>
                <p className="mt-1 text-ui text-ink">
                  {play.test.size} · {play.test.budget} · {play.test.durationDays} days
                </p>
                <p className="text-xs text-ink-3">Watch: {play.test.leadingMetric}</p>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                  <Crosshair aria-hidden className="size-3.5" /> Decide
                </p>
                <p className="mt-1 flex items-start gap-1 text-ui text-ink">
                  <X aria-hidden className="mt-0.5 size-3.5 shrink-0 text-red-800" /> {play.test.killIf}
                </p>
                <p className="flex items-start gap-1 text-ui text-ink">
                  <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-800" /> {play.test.scaleIf}
                </p>
              </div>
            </div>
            {play.climbosCanDo ? (
              <p className="text-ui text-ink-2">
                <span className="font-medium text-ink">Your team will: </span>
                {play.climbosCanDo}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
          <p className="text-ui text-ink-2">
            <span className="font-medium text-ink">Today: </span>
            {play.firstActionToday}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await send({ slug, text: `Start the "${play.name}" play: ${play.oneLiner} Audience: ${play.audience.who} (${play.audience.where}). Hook: ${play.hook}. Prepare everything your team can do for it now: ${play.climbosCanDo}` });
                  router.push(`/app/${slug}/today`);
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Sparkles aria-hidden /> Make it happen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? "Hide the numbers" : "How we estimate it"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function GrowthPlays({ plays, slug }: { plays: PlayView[]; slug: string }) {
  if (!plays.length) return null;
  const order = { bankable: 0, creative: 1, moonshot: 2 } as const;
  const sorted = [...plays].sort((a, b) => order[a.kind] - order[b.kind]);
  return (
    <PlanSection id="plays" title="Growth plays" intro="One bankable play, one or two creative ones with proven mechanics, and at most one capped moonshot. Every forecast comes from cited base rates and gets tested before anything scales.">
      <div className={cn("grid gap-4", sorted.length > 2 ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")}>
        {sorted.map((p) => (
          <PlayCard key={p.name} play={p} slug={slug} />
        ))}
      </div>
    </PlanSection>
  );
}

export function ExecutionPlan({ expert }: { expert: ExpertView }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-overline">This week</p>
          <ol className="flex flex-col gap-2">
            {expert.weekOneChecklist.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-ui text-ink">
                <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border border-control text-2xs text-ink-3">
                  {i + 1}
                </span>
                {w}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-overline">Phases</p>
          <ol className="relative flex flex-col gap-3 border-l border-line-strong pl-4">
            {expert.phases.map((p) => (
              <li key={p.name} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-surface bg-brand-800" />
                <p className="text-ui font-medium text-ink">
                  {p.name} <span className="font-normal text-ink-3">· {p.days}</span>
                </p>
                <p className="text-xs text-ink-3">{p.focus}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div>
            <p className="text-overline">Not doing (on purpose)</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {expert.notDoing.map((n) => (
                <li key={n.channel} className="text-ui">
                  <span className="font-medium text-ink line-through decoration-ink-3/60">{n.channel}</span> <span className="text-ink-3">· {n.why}</span>
                </li>
              ))}
            </ul>
          </div>
          {expert.risks.length ? (
            <div className="border-t border-line pt-3">
              <p className="text-overline flex items-center gap-1.5">
                <TriangleAlert aria-hidden className="size-3.5" /> Risks
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {expert.risks.slice(0, 3).map((r) => (
                  <li key={r.risk} className="text-ui text-ink-2">
                    <span className="text-ink">{r.risk}</span> → {r.mitigation}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
