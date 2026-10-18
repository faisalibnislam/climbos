"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { CircleCheck, Crosshair, FlaskConical, Gem, Info, Rocket, ShieldCheck, Sparkles, Target, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, CardContent, Tooltip, toast, type Tone } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { cn } from "@/lib/utils";
import { churnOf, OWNER_HOUR_USD, playMaths, type Economics, type PlayModel } from "../../../../shared/agents/economics";
import { PlanSection } from "./PlanSections";
import { climbTarget } from "@/components/climb/context";

/** Mirrors shared/agents/specs PlaySchema (stored loosely in Convex). */
export interface PlayView {
  name: string;
  oneLiner: string;
  kind: "bankable" | "creative" | "moonshot";
  audience: string;
  trigger: string;
  hook: string;
  mechanic: string;
  assetUsed: string;
  funnel: string[];
  unit: string;
  p10: number;
  p50: number;
  p90: number;
  horizonDays: number;
  confidence: "high" | "medium" | "low";
  biggestUnknown: string;
  test: string;
  killIf: string;
  scaleIf: string;
  /** fit, predictability, leverage, timeToSignal, compounding, cost, risk, distinctiveness */
  scores: number[];
  firstActionToday: string;
  climbosCanDo: string;
  model?: PlayModel;
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
function score(sc: number[]) {
  const c = (i: number) => Math.max(1, Math.min(5, sc[i] ?? 1));
  return Math.round(20 * (0.25 * c(0) + 0.2 * c(1) + 0.15 * c(2) + 0.1 * c(3) + 0.1 * c(4) + 0.1 * c(5) + 0.1 * c(6)));
}
const distinct = (sc: number[]) => Math.max(1, Math.min(5, sc[7] ?? 1));

const isShort = (s: string) => s.length <= 24;

export function NorthStar({ expert }: { expert: ExpertView }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
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
          {/* Values range from "20 customers" to full sentences: short ones get the big number, long ones wrap as text. */}
          <dl className="grid min-w-0 gap-2">
            <div className="min-w-0">
              <dt className="text-xs text-ink-3">Now</dt>
              <dd className="break-words text-sm text-ink-2">{expert.northStar.baseline}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-ink-3">Target</dt>
              <dd className={cn("break-words", isShort(expert.northStar.target) ? "metric text-xl leading-6" : "text-sm font-medium text-ink")}>{expert.northStar.target}</dd>
            </div>
          </dl>
          {expert.leadingIndicators.length ? (
            <ul className="mt-1 flex min-w-0 flex-col gap-2 border-t border-line pt-2">
              {expert.leadingIndicators.map((l) => (
                <li key={l.metric} className="min-w-0 text-ui">
                  {isShort(l.weeklyTarget) ? (
                    <span className="flex justify-between gap-3">
                      <span className="min-w-0 break-words text-ink-2">{l.metric}</span>
                      <span className="shrink-0 font-medium tabular-nums text-ink">{/week|wk/i.test(l.weeklyTarget) ? l.weeklyTarget : `${l.weeklyTarget}/wk`}</span>
                    </span>
                  ) : (
                    <>
                      <span className="block break-words font-medium text-ink">{l.metric}</span>
                      <span className="block break-words text-ink-3">{l.weeklyTarget}</span>
                    </>
                  )}
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
function ForecastBar({ f }: { f: PlayView }) {
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

/** The play's maths, computed in code from its own numbers. */
function PlayEconomics({ play, economics }: { play: PlayView; economics: Economics }) {
  const m = playMaths({ ...play, model: play.model! }, economics);
  const usd = (n: number | null) => (n === null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
  return (
    <p className={cn("text-xs", m.profitable ? "text-ink-3" : "text-red-800")}>
      Cost per customer <span className="font-medium text-ink">{usd(m.cacUsd)}</span> · worth {usd(m.valueUsd)} a year
      {m.paybackMonths !== null ? ` · pays back in ${Math.max(0.1, Math.round(m.paybackMonths * 10) / 10)} months` : ""}
    </p>
  );
}

function PlayCard({ play, slug, economics }: { play: PlayView; slug: string; economics?: Economics }) {
  const k = KIND[play.kind] ?? KIND.creative;
  const send = useMutation(api.workspace.sendChat);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const total = score(play.scores);
  return (
    <article {...climbTarget("play", play.name, `${play.name} (${play.kind} play)`)} className={cn("flex flex-col overflow-hidden rounded-xl border bg-surface", play.kind === "creative" ? "border-violet-500/40" : "border-line")}>
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
              <span className="flex items-center gap-0.5" aria-label={`Distinctiveness ${distinct(play.scores)} of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} aria-hidden className={cn("size-1.5 rounded-full", i <= distinct(play.scores) ? "bg-violet-500" : "bg-surface-3")} />
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
            <dd className="text-ink">{play.audience}</dd>
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

        <ForecastBar f={play} />
        {play.model && economics ? <PlayEconomics play={play} economics={economics} /> : null}

        {open ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-overline">How we estimate it</p>
              <ol className="mt-2 flex flex-col gap-1.5">
                {play.funnel.map((line, i) => {
                  const grade = line.match(/\[[^\]]*,\s*([ABCD])\]/)?.[1] ?? (/assumption|grade d/i.test(line) ? "D" : null);
                  return (
                    <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg bg-surface-2/70 px-2.5 py-1.5 text-ui text-ink">
                      <span>{line.replace(/\s*\[[^\]]*\]\s*$/, "")}<span className="block text-xs text-ink-3">{line.match(/\[([^\]]*)\]/)?.[1] ?? ""}</span></span>
                      {grade ? (
                        <Tooltip content={GRADE[grade]}>
                          <span tabIndex={0} className="grid size-6 place-items-center rounded-md border border-line text-xs font-semibold text-ink-2">
                            {grade}
                          </span>
                        </Tooltip>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              {play.biggestUnknown ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-3">
                  <Info aria-hidden className="mt-px size-3.5 shrink-0" /> Biggest unknown: {play.biggestUnknown}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-line p-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                  <FlaskConical aria-hidden className="size-3.5" /> The test
                </p>
                <p className="mt-1 text-ui text-ink">{play.test}</p>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                  <Crosshair aria-hidden className="size-3.5" /> Decide
                </p>
                <p className="mt-1 flex items-start gap-1 text-ui text-ink">
                  <X aria-hidden className="mt-0.5 size-3.5 shrink-0 text-red-800" /> {play.killIf}
                </p>
                <p className="flex items-start gap-1 text-ui text-ink">
                  <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-800" /> {play.scaleIf}
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
                  await send({ slug, text: `Start the "${play.name}" play: ${play.oneLiner} Audience: ${play.audience}. Hook: ${play.hook}. Prepare everything your team can do for it now: ${play.climbosCanDo}` });
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

/** The unit economics every play's numbers rest on, with what's assumed called out (spec §25). */
function EconomicsLine({ economics: e }: { economics: Economics }) {
  const churn = churnOf(e);
  const assumed = new Set(e.assumed ?? []);
  const part = (label: string, value: string, key: string) => (
    <span>
      {label} <span className="font-medium text-ink">{value}</span>
      {assumed.has(key) ? <span className="text-amber-800"> (assumed)</span> : null}
    </span>
  );
  return (
    <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
      <span>Each play is costed on:</span>
      {part("revenue", `$${Math.round(e.revenuePerCustomerMonthUsd * 100) / 100}/month`, "revenue")}
      {part("margin", `${Math.round((e.grossMargin > 1 ? e.grossMargin : e.grossMargin * 100))}%`, "margin")}
      {churn !== null ? part("churn", `${Math.round(churn * 1000) / 10}%/month`, "churn") : null}
      <span>
        owner time <span className="font-medium text-ink">${e.ownerHourUsd || OWNER_HOUR_USD}/hour</span>
      </span>
    </p>
  );
}

export function GrowthPlays({ plays, slug, economics }: { plays: PlayView[]; slug: string; economics?: Economics }) {
  if (!plays.length) return null;
  const order = { bankable: 0, creative: 1, moonshot: 2 } as const;
  const sorted = [...plays].sort((a, b) => order[a.kind] - order[b.kind]);
  return (
    <PlanSection id="plays" title="Growth plays" intro="One bankable play, one or two creative ones with proven mechanics, and at most one capped moonshot. Forecasts are computed from cited rates and their ranges; each play is tested before it scales.">
      {economics ? <EconomicsLine economics={economics} /> : null}
      <div className={cn("grid gap-4", sorted.length > 2 ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")}>
        {sorted.map((p) => (
          <PlayCard key={p.name} play={p} slug={slug} economics={economics} />
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
