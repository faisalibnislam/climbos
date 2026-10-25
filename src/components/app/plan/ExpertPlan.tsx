"use client";

import { GAP_LABEL, type GoalGap } from "../../../../shared/agents/goal";
import { CONSTRAINT_LABEL, type BindingConstraint, type Decision } from "../../../../shared/agents/decision";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { PlayActuals } from "../../../../shared/growth/actuals";
import { CREATIVE_PRECEDENTS } from "../../../../shared/knowledge/creativePrecedents";
import { PlayResults } from "./PlayResults";
import {
  ArrowRight,
  Ban,
  CalendarClock,
  CalendarDays,
  ChartLine,
  CircleCheck,
  CircleHelp,
  Crosshair,
  ExternalLink,
  Eye,
  Flag,
  FlaskConical,
  Gem,
  Info,
  Lightbulb,
  ListChecks,
  Rocket,
  Search,
  ShieldCheck,
  Magic,
  Sparkles,
  Target,
  TriangleAlert,
  UsersRound,
  Wallet,
  X,
  Megaphone,
  Zap,
  type LucideIcon,
} from "@/components/icons";
import Link from "next/link";
import type { PlayTargets } from "@convex/targets";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { Badge, Button, Callout, Card, CardContent, Field, Select, Segmented, Textarea, Tooltip, toast, type CalloutTone, type Tone } from "@/components/ui";
import { ChartTooltip, CHART, ScatterPlot, SrTable, XTicks, focusRing, niceScale, useKeyNav } from "@/components/ds/charts";
import { errorMessage } from "@/components/app/errors";
import { cn } from "@/lib/utils";
import { formatMoney } from "../../../../shared/economics/currency";
import { playConfidence, type EvidenceLevel, type PlayConfidence } from "../../../../shared/agents/confidence";
import type { Diagnosis } from "../../../../shared/agents/diagnosis";
import { churnOf, ownerHourOf, playMaths, type Economics, type ForecastUncertainty, type PlayModel, type PlaySensitivity, type PortfolioChoice } from "../../../../shared/agents/economics";
import { fmtInput as fmtSwitch, switchPoints } from "../../../../shared/agents/voi";
import { ACCESS_LABEL, BASIS_LABEL, CHECK_LABEL, COST_BASIS_LABEL, economicsSources, forecastBasis, playInputs, SOURCE_LABEL, type InputRow } from "../../../../shared/agents/provenance";
import { Clamp, DetailsToggle, ExpandAll, FieldLabel, PlanSection, splitLinks, LinkChip } from "./PlanSections";
import { FeedbackButton } from "./Feedback";
import { ProseBullets } from "@/components/app/ProseBullets";
import { StatBlocks } from "@/components/ds/content";
import { climbTarget } from "@/components/climb/context";
import type { StrategyExploration } from "../../../../shared/agents/specs";
import type { CampaignTiming } from "../../../../shared/agents/campaignTiming";
import type { OfferAssessment } from "../../../../shared/agents/offerAssessment";
import { CampaignTimingSummary } from "./CampaignTimingSummary";
import { OfferAssessmentPanel } from "./OfferAssessmentPanel";

/** Mirrors shared/agents/specs PlaySchema (stored loosely in Convex). */
export interface PlayView {
  /** Stable play ID (S4), carried across plan versions. */
  id?: string;
  name: string;
  oneLiner: string;
  kind: "bankable" | "creative" | "moonshot";
  audience: string;
  trigger: string;
  hook: string;
  mechanic: string;
  assetUsed: string;
  /** How qualified visitors reach the asset (older plans lack it). */
  route?: string;
  funnel: string[];
  unit: string;
  p10: number;
  p50: number;
  p90: number;
  horizonDays: number;
  confidence: "high" | "medium" | "low";
  biggestUnknown: string;
  forecastUncertainty?: ForecastUncertainty | null;
  sensitivity?: PlaySensitivity[];
  test: string;
  killIf: string;
  scaleIf: string;
  /** fit, predictability, leverage, timeToSignal, compounding, cost, risk, distinctiveness */
  scores: number[];
  firstActionToday: string;
  climbosCanDo: string;
  actionContract?: {
    diagnosis: string;
    intendedEffect: string;
    evidenceBasis: "assumption" | "inference" | "measured" | "owner_report" | "source_claim";
    evidenceNote: string;
    evidenceRefs: string[];
    targetOrAsset: string;
    resourcePlan: string;
    executionCapability: "owner" | "climbos" | "existing_integration" | "external_setup" | "unknown";
    dependencies: string[];
    measurement: { metric: string; baseline: string; target: string; windowDays: number; source: string };
  };
  actionReadiness?: { status: "safe_to_start" | "depends_on_input"; reasons: string[] };
  creativeReview?: {
    challenge: string; conventionBasis: "verified_rule" | "common_habit" | "assumption" | "unknown"; costOfBreaking: string;
    customerTensionOrAsset: string; precedentIds: string[]; transferLogic: string;
    keyDifferences: string; hopedCustomerBehavior: string; assumptions: string[];
    novelty: "low" | "medium" | "high"; evidenceStrength: "low" | "medium" | "high";
    businessFit: "low" | "medium" | "high"; feasibility: "low" | "medium" | "high";
    risk: "low" | "medium" | "high"; reversibleTest: string; successSignal: string;
    guardrail: string; stopCondition: string; revisionEvidence: string;
  };
  model?: PlayModel;
  timingAssessment?: CampaignTiming & { researchRetrievedAt?: string | null };
  offerAssessment?: OfferAssessment;
}

const EVIDENCE_BASIS_LABEL: Record<NonNullable<PlayView["actionContract"]>["evidenceBasis"], string> = {
  assumption: "Assumption to test",
  inference: "Reasoned inference",
  measured: "Measured in this business",
  owner_report: "Reported by your team",
  source_claim: "Claim from a source",
};

const CAPABILITY_LABEL: Record<NonNullable<PlayView["actionContract"]>["executionCapability"], string> = {
  owner: "Your team carries this out",
  climbos: "ClimbOS can prepare this",
  existing_integration: "Needs a connected tool",
  external_setup: "Needs setup outside ClimbOS",
  unknown: "Who will carry this out is not yet confirmed",
};

export interface ExpertView {
  diagnosis: string;
  /** Deterministic owner-data diagnosis retained separately from the model's explanation. */
  constraintDiagnosis?: Diagnosis | null;
  affordableCac: string;
  notDoing: { channel: string; why: string }[];
  northStar: { metric: string; baseline: string; target: string };
  leadingIndicators: { metric: string; weeklyTarget: string; source: string }[];
  phases: { name: string; days: string; focus: string }[];
  weekOneChecklist: string[];
  risks: { risk: string; mitigation: string }[];
  plays?: PlayView[];
  /** Exploratory alternatives are not part of the ranked execution portfolio. */
  strategyExploration?: StrategyExploration;
  /** Owner goal vs what the plays support (computed in code). */
  goalGap?: GoalGap | null;
  snapshot?: { goal?: string };
  /** decision_contract plans: the structured decision (shared/agents/decision.ts). */
  decision?: Decision | null;
  portfolioComparisons?: {
    horizonDays: number;
    modeledPlayCount: number;
    baselinePlayCount: number;
    playAttributed: PortfolioChoice | null;
    modeledIncremental: PortfolioChoice | null;
  };
}

/** Each play type has its own colour identity (flat token tints, never colour alone: label + icon too). */
const KIND: Record<
  PlayView["kind"],
  { label: string; icon: LucideIcon; hint: string; band: string; rail: string; soft: string; tile: string; ink: string; quote: string; chart: string }
> = {
  bankable: {
    label: "Practical · established practice",
    icon: ShieldCheck,
    hint: "A practical move grounded in an established approach; fit and results still need business-specific evidence.",
    band: "bg-chart-1/10",
    rail: "bg-chart-1",
    soft: "bg-chart-1/30",
    tile: "bg-chart-1/15 text-brand-800",
    ink: "text-brand-800",
    quote: "border-chart-1",
    chart: CHART.sage,
  },
  creative: {
    label: "A related approach · needs checking",
    icon: Gem,
    hint: "A useful idea carried into a less familiar context; the evidence supports the inference, not a guaranteed result.",
    band: "bg-chart-3/10",
    rail: "bg-chart-3",
    soft: "bg-chart-3/30",
    tile: "bg-chart-3/15 text-chart-3",
    ink: "text-chart-3",
    quote: "border-chart-3",
    chart: CHART.slate,
  },
  moonshot: {
    label: "A bold idea · not proven",
    icon: Rocket,
    hint: "A speculative high-upside hypothesis, not an established result. Use a small reversible test with a hard stop and name what would disprove it.",
    band: "bg-chart-4/10",
    rail: "bg-chart-4",
    soft: "bg-chart-4/30",
    tile: "bg-chart-4/15 text-orange-800",
    ink: "text-orange-800",
    quote: "border-chart-4",
    chart: CHART.clay,
  },
};
const kindOf = (k: string) => KIND[k as PlayView["kind"]] ?? KIND.creative;

const CONFIDENCE: Record<PlayView["confidence"], { label: string; tone: Tone }> = {
  high: { label: "High confidence", tone: "green" },
  medium: { label: "Medium confidence", tone: "amber" },
  low: { label: "Low confidence", tone: "red" },
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
/** Whole amounts in the plan's currency (economics.currency; older plans are USD). */
const usd = (n: number | null, currency?: string) => (n === null ? "—" : formatMoney(Math.round(n), currency, "—"));

/* ---------------- North star ---------------- */

/** A leading number in a short value ("120 customers" → 120), or null. */
const leadNum = (s: string) => {
  if (!isShort(s)) return null;
  const m = /^\$?\s?(\d[\d,]*(?:\.\d+)?)/.exec(s.trim());
  return m ? Number(m[1].replace(/,/g, "")) : null;
};

function RouteBar({ baseline, target }: { baseline: string; target: string }) {
  const b = leadNum(baseline);
  const t = leadNum(target);
  const pct = b !== null && t !== null && t > 0 ? Math.max(0, Math.min(100, (b / t) * 100)) : null;
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-sage-ink bg-surface" />
      {pct !== null ? (
        <div
          role="meter"
          aria-label="Progress from now to target"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={`${baseline} of ${target}`}
          className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3"
        >
          <span className="absolute inset-y-0 left-0 rounded-full bg-sun-strong" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <span aria-hidden className="h-0 flex-1 border-t-2 border-dashed border-brand-300" />
      )}
      <Flag aria-hidden className="size-4 shrink-0 text-sun-strong" />
    </div>
  );
}

function ValueTile({ label, value, icon: Icon, className }: { label: string; value: string; icon: LucideIcon; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] p-3", className)}>
      <dt>
        <FieldLabel icon={Icon}>{label}</FieldLabel>
      </dt>
      <dd className="min-w-0">
        {isShort(value) ? (
          <span className="text-kpi font-semibold tabular-nums text-ink">{value}</span>
        ) : (
          <Clamp lines={2} className="text-ui font-medium text-ink">
            {value}
          </Clamp>
        )}
      </dd>
    </div>
  );
}

const SOURCE_WORD: Record<string, string> = { owner: "you", site: "your site", research: "research", results: "your results", inference: "inferred" };

/** The decision first; observations, explanations and the options that lost behind a toggle (REQ-STRAT-01/02, REQ-UX-01). */
function DecisionSummary({ d }: { d: Decision }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const chosen = d.options.find((o) => o.chosen);
  const lost = d.options.filter((o) => !o.chosen);
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface-2 p-3">
      <FieldLabel icon={Crosshair}>Likely constraint · ClimbOS interpretation</FieldLabel>
      <h3 className="heading-card">{CONSTRAINT_LABEL[d.constraint as BindingConstraint] ?? d.constraint}</h3>
      <dl className="flex flex-col gap-1 text-ui">
        <div>
          <dt className="inline font-semibold text-ink">Recommendation: </dt>
          <dd className="inline text-ink-2">{d.guidingPolicy}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-ink">We&apos;re wrong if: </dt>
          <dd className="inline text-ink-2">{d.falsifier}</dd>
        </div>
      </dl>
      {open ? (
        <div id={panel} className="flex flex-col gap-3 border-t border-line pt-2.5 text-ui">
          {d.observations.length ? (
            <div className="flex flex-col gap-1">
              <FieldLabel icon={Eye}>What we saw</FieldLabel>
              <ul className="flex flex-col gap-1">
                {d.observations.map((o, i) => (
                  <li key={i} className="flex min-w-0 items-start gap-2 text-ink-2">
                    <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 bg-brand-700" />
                    <span className="min-w-0">
                      {o.observation} <span className="text-xs text-ink-3">· {SOURCE_WORD[o.source] ?? o.source}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {d.explanations.length ? (
            <div className="flex flex-col gap-1">
              <FieldLabel icon={Lightbulb}>Competing explanations to check</FieldLabel>
              <ul className="flex flex-col gap-1.5">
                {d.explanations.map((e, i) => (
                  <li key={i} className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-control)] bg-surface px-2.5 py-1.5">
                    <span className="text-ink">{e.explanation}</span>
                    {e.evidenceFor ? (
                      <span className="text-xs text-ink-3">
                        <span className="font-medium text-green-800">For: </span>
                        {e.evidenceFor}
                      </span>
                    ) : null}
                    {e.evidenceAgainst ? (
                      <span className="text-xs text-ink-3">
                        <span className="font-medium text-red-800">Against: </span>
                        {e.evidenceAgainst}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {chosen || lost.length ? (
            <div className="flex flex-col gap-1">
              <FieldLabel icon={ListChecks}>Options</FieldLabel>
              <ul className="flex flex-col gap-1.5">
                {chosen ? (
                  <li className="flex items-start gap-1.5 text-ink">
                    <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-green-800" />
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="font-medium">{chosen.name}</span>
                      <Badge tone="green">Chosen</Badge>
                    </span>
                  </li>
                ) : null}
                {lost.map((o, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-ink-2">
                    <X aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                    <span className="min-w-0">
                      {o.name}
                      <span className="block text-xs text-ink-3">{o.whyNot}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {d.limits ? (
            <p className="flex items-start gap-1.5 text-xs text-ink-3">
              <CircleHelp aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                <span className="font-medium text-ink-2">Not known yet: </span>
                {d.limits}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
      <span className="self-start">
        <DetailsToggle open={open} onToggle={() => setOpen((v) => !v)} label="Why this, not something else" controls={panel} />
      </span>
    </div>
  );
}

const GAP_TONE: Record<GoalGap["state"], CalloutTone> = { met: "success", short: "warning", out_of_reach: "warning", unknown: "info", not_comparable: "info" };

export function NorthStar({ expert, slug }: { expert: ExpertView; slug: string }) {
  const [all, setAll] = useState(false);
  const ns = expert.northStar;
  const gap = expert.goalGap ?? null;
  const goal = gap && expert.snapshot?.goal ? expert.snapshot.goal : null;
  const nextMeasurement = expert.constraintDiagnosis?.nextMeasurement;
  const conflicts = expert.constraintDiagnosis?.conflicts ?? [];
  const targetLabel = gap ? "What the actions may achieve" : "Target";
  const allShort = isShort(ns.baseline) && isShort(ns.target) && (goal === null || isShort(goal));
  return (
    <PlanSection id="northstar-heading" title="Where you stand" navLabel="Where you stand" icon={Target} bare>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="flex h-full flex-col gap-3">
            <p className="text-overline">What needs attention</p>
            {expert.decision ? <DecisionSummary d={expert.decision} /> : null}
            <ProseBullets text={expert.diagnosis} max={3} />
            {conflicts.length ? <Callout tone="warning" title="Check these business numbers first" action={<Link href={`/app/${encodeURIComponent(slug)}/settings/business`}>Update business numbers <ArrowRight aria-hidden className="inline size-3.5" /></Link>}>
              <ul className="list-disc pl-5">{conflicts.slice(0, 4).map((conflict, i) => <li key={`${conflict}-${i}`}>{conflict}</li>)}</ul>
            </Callout> : nextMeasurement ? <Callout tone={nextMeasurement.priority === "decision_critical" ? "warning" : "info"} title={nextMeasurement.priority === "decision_critical" ? "Needed before a firm diagnosis" : "Most useful next step"} action={<Link href={`/app/${encodeURIComponent(slug)}/settings/business`}>Add or update business numbers <ArrowRight aria-hidden className="inline size-3.5" /></Link>}>
              <p className="font-medium text-ink">{nextMeasurement.action}</p>
              <p className="mt-1">{nextMeasurement.reason}</p>
            </Callout> : null}
            {expert.affordableCac ? (
              <div className="mt-auto flex flex-col gap-1 rounded-[var(--radius-card)] bg-cream-soft p-3">
                <FieldLabel icon={Wallet}>Affordable cost per customer</FieldLabel>
                <ProseBullets text={expert.affordableCac} max={2} />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col gap-3">
            <p className="text-overline flex items-center gap-1.5">
              <Target aria-hidden className="size-3.5" /> North star
            </p>
            <h3 className="heading-card">{ns.metric}</h3>
            <RouteBar baseline={ns.baseline} target={ns.target} />
            {allShort ? (
              <StatBlocks
                stats={[
                  { label: "Now", value: ns.baseline },
                  ...(goal ? [{ label: "Your goal", value: goal }] : []),
                  { label: targetLabel, value: ns.target, tone: gap ? (gap.state === "met" ? "good" : gap.state === "short" || gap.state === "out_of_reach" ? "warn" : "default") : "good" },
                ]}
              />
            ) : (
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ValueTile label="Now" value={ns.baseline} icon={CircleCheck} className="bg-surface-2" />
                <ValueTile label={targetLabel} value={ns.target} icon={Flag} className="bg-sun-soft" />
                {goal ? <ValueTile label="Your goal" value={goal} icon={Target} className="bg-surface-2 sm:col-span-2" /> : null}
              </dl>
            )}
            {gap ? (
              <Callout tone={GAP_TONE[gap.state] ?? "info"} title={GAP_LABEL[gap.state]}>
                {gap.note}
              </Callout>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {expert.leadingIndicators.length ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-overline flex items-center gap-1.5">
              <ChartLine aria-hidden className="size-3.5" /> Weekly signals
              <span className="ml-auto">
                <ExpandAll open={all} onToggle={() => setAll((v) => !v)} />
              </span>
            </p>
            <ul className="flex flex-col divide-y divide-line">
              {expert.leadingIndicators.map((l, i) => (
                <li key={l.metric} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)]">
                  <span aria-hidden className="mt-px grid size-5 place-items-center rounded-[var(--radius-badge)] bg-brand-100 text-2xs font-semibold text-brand-900 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="text-ui font-medium text-ink">{l.metric}</span>
                    {l.source ? (
                      <Badge title={l.source} className={all ? "h-auto whitespace-normal [&>span:last-child]:whitespace-normal" : undefined}>
                        {l.source}
                      </Badge>
                    ) : null}
                  </span>
                  {isShort(l.weeklyTarget) ? (
                    <span className="col-start-2 md:col-start-auto">
                      <Badge tone="brand">{/week|wk/i.test(l.weeklyTarget) ? l.weeklyTarget : `${l.weeklyTarget}/wk`}</Badge>
                    </span>
                  ) : (
                    <Clamp lines={1} toggle={false} expanded={all} className="col-start-2 text-ui text-ink-2 md:col-start-auto">
                      {l.weeklyTarget}
                    </Clamp>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </PlanSection>
  );
}

/* ---------------- Play card parts ---------------- */

/** Neutral economics for plays saved without any (customer forecasts don't use them). */
const NO_ECONOMICS: Economics = { revenuePerCustomerMonthUsd: 0, grossMargin: 0, basis: "" };

const BASIS_TONE: Record<string, Tone> = { assumption_scenario: "amber", sourced_estimate: "blue", unlabelled_scenario: "neutral" };

const LEVEL_TONE: Record<EvidenceLevel, Tone> = { strong: "green", some: "amber", weak: "neutral" };

/** Three separate judgments: is the problem real, does this fix work, how firm is the forecast. */
function ConfidenceChips({ c }: { c: PlayConfidence }) {
  const rows: { k: keyof PlayConfidence["why"]; label: string }[] = [
    { k: "problem", label: "Problem" },
    { k: "fix", label: "Fix" },
    { k: "forecast", label: "Forecast" },
  ];
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Evidence">
      {rows.map((r) => (
        <li key={r.k}>
          <Tooltip content={c.why[r.k]}>
            <Badge tone={LEVEL_TONE[c[r.k]]} className="cursor-help">
              {r.label}: {c[r.k]}
            </Badge>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

/** The forecast as a KPI: point estimate at stated inputs, scenario range, and evidence. */
function Forecast({ f, economics, open = false, diagnosis }: { f: PlayView; economics?: Economics; open?: boolean; diagnosis?: Diagnosis | null }) {
  const k = kindOf(f.kind);
  const max = Math.max(f.p90, 1) * 1.1;
  const pos = (n: number) => Math.min(100, Math.max(0, (n / max) * 100));
  const basis = f.model?.steps?.length ? forecastBasis({ ...f, model: f.model }, economics ?? NO_ECONOMICS).customers : null;
  const scenario = basis?.kind !== "sourced_estimate";
  const evidence = playConfidence(f as never, economics ?? NO_ECONOMICS, diagnosis);
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-overline">
          {scenario ? "Scenario" : "Forecast"} · {f.horizonDays} days
        </p>
        <ConfidenceChips c={evidence} />
      </div>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-kpi font-semibold tabular-nums text-ink">{fmtN(f.p50)}</span>
        <span className="min-w-0 flex-1 text-ui text-ink-2" title={f.unit}>
          {lead(f.unit).head} <span className="text-ink-3">· point at stated inputs</span>
        </span>
      </div>
      <div className="relative h-5" role="img" aria-label={`${scenario ? "Scenario" : "Forecast"}: lower scenario ${fmtN(f.p10)}, point at stated inputs ${fmtN(f.p50)}, upper scenario ${fmtN(f.p90)} ${lead(f.unit).head}`}>
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
        <span aria-hidden className={cn("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full", k.soft)} style={{ left: `${pos(f.p10)}%`, width: `${Math.max(1, pos(f.p90) - pos(f.p10))}%` }} />
        <span aria-hidden className={cn("absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2", k.rail)} style={{ left: `${pos(f.p10)}%` }} />
        <span aria-hidden className={cn("absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2", k.rail)} style={{ left: `${pos(f.p90)}%` }} />
        <span aria-hidden className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", k.rail)} style={{ left: `${pos(f.p50)}%` }} />
      </div>
      <dl className="grid grid-cols-3 text-xs">
        <div>
          <dt className="text-ink-3">Lower scenario</dt>
          <dd className="font-medium tabular-nums text-ink">{fmtN(f.p10)}</dd>
        </div>
        <div className="text-center">
          <dt className="text-ink-3">At stated inputs</dt>
          <dd className="font-semibold tabular-nums text-ink">{fmtN(f.p50)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-ink-3">Upper scenario</dt>
          <dd className="font-medium tabular-nums text-ink">{fmtN(f.p90)}</dd>
        </div>
      </dl>
      {basis ? (
        <div className="flex flex-col gap-1">
          <Badge tone={BASIS_TONE[basis.kind] ?? "neutral"} className="self-start">
            {BASIS_LABEL[basis.kind]}
          </Badge>
          {basis.assumed.length || basis.unchecked.length ? (
            <Clamp lines={1} toggle={false} expanded={open} className="text-xs text-ink-3">
              {basis.assumed.length ? <span className="text-amber-800">Assumed: {basis.assumed.join(", ")}. </span> : null}
              {basis.unchecked.length ? <span>Not checked: {basis.unchecked.join(", ")}.</span> : null}
            </Clamp>
          ) : null}
        </div>
      ) : null}
      {f.forecastUncertainty ? (
        <dl className="grid gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-3 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink-2">Scenario range</dt>
            <dd>{f.forecastUncertainty.rangeMethod === "input_scenario" ? `Lower and upper values vary ${f.forecastUncertainty.variedDrivers.join(", ") || "the stated inputs"}.` : "No input ranges were supplied; all three values use the same stated inputs."}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-2">Statistical confidence</dt>
            <dd>Not estimated. This range is not a statistical confidence interval or calibrated probability.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-2">Real-world factors not modeled</dt>
            <dd>{f.forecastUncertainty.omittedFactors.join(", ").replaceAll("_", " ")}.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-2">Timing assumptions</dt>
            <dd>Reach ramp: {f.forecastUncertainty.timing.reachRamp === "modeled" ? "modeled" : "assumed immediate"}; paid conversion lag: {f.forecastUncertainty.timing.paidConversionLag === "modeled" ? "modeled" : "none assumed"}.</dd>
          </div>
        </dl>
      ) : <p className="text-xs text-ink-3">This saved plan does not record how its range was built.</p>}
    </div>
  );
}

/** The play's maths, computed in code from its own numbers. */
function PlayEconomics({ play, economics }: { play: PlayView; economics: Economics }) {
  const m = playMaths({ ...play, model: play.model! }, economics);
  const cost = forecastBasis({ ...play, model: play.model! }, economics).cost;
  const pb = m.paybackMonths === null ? null : Math.max(0.1, Math.round(m.paybackMonths * 10) / 10);
  // What decides it (Hubbard's threshold): the input closest to flipping the verdict, computed in code.
  const top = switchPoints({ ...play, model: play.model! }, economics).find((s) => s.switchValue !== null);
  const money = (n: number) => usd(n, economics.currency);
  return (
    <div className="flex flex-col gap-1.5">
      <StatBlocks
        className="grid-cols-3 sm:grid-cols-3"
        stats={[
          {
            label: "Cost to win one customer",
            value: usd(m.cacUsd, economics.currency),
            tone: m.profitable === true ? "good" : m.profitable === false ? "bad" : "default",
            hint: m.profitable === true ? "Below modeled 12-month contribution" : m.profitable === false ? "Above modeled 12-month contribution" : undefined,
          },
          m.valueUsd === null ? { label: "Modeled money left in 12 months", value: "Unknown", hint: "Add price, margin and churn" } : { label: "Modeled money left in 12 months", value: usd(m.valueUsd, economics.currency) },
          {
            label: "Months to recover the cost",
            value: pb === null ? "—" : `${pb} mo`,
            tone: pb === null ? "default" : pb <= 6 ? "good" : pb <= 12 ? "warn" : "bad",
            // Churn-weighted payback (longer than "per surviving customer"); named so it isn't compared with other definitions.
            hint: pb === null ? undefined : `${pb <= 6 ? "Fast" : pb <= 12 ? "Within a year" : "Over a year"} · with churn`,
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={m.robustness === "robust" ? "green" : m.robustness === "fragile" ? "amber" : m.robustness === "loses" ? "red" : "neutral"}>
          {m.robustness === "robust" ? "Holds at low scenario" : m.robustness === "fragile" ? "Middle case only" : m.robustness === "loses" ? "Does not break even in middle case" : "Break-even unknown"}
        </Badge>
        <span className="text-xs text-ink-3">Conditional on the listed inputs; not a guaranteed result.</span>
      </div>
      <details className="rounded-[var(--radius-control)] border border-line px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-ink-2">What these money estimates mean</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-3">
          <li>Cost to win one customer divides this play&apos;s estimated cash costs and the value of your time by its modeled new paying customers.</li>
          <li>Modeled money left in 12 months applies the supplied share of revenue left after variable costs to each month the customer is expected to remain active. Monthly cancellations reduce the estimate. It is before fixed overhead, taxes, and any costs not included in those inputs.</li>
          <li>Months to recover the cost estimates how long that customer&apos;s money left after variable costs takes to cover the cost to win them, allowing for cancellations. It is a model, not a promised result.</li>
        </ul>
      </details>
      <dl className="grid gap-2 rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-ink-3">Cash over {play.horizonDays} days</dt><dd className="font-medium tabular-nums text-ink">{money(m.costBreakdown.cashMediaUsd + m.costBreakdown.cashOtherUsd)}</dd><dd className="text-xs text-ink-3">Media {money(m.costBreakdown.cashMediaUsd)} + other cash costs {money(m.costBreakdown.cashOtherUsd)}</dd></div>
        <div><dt className="text-xs text-ink-3">Owner time value</dt><dd className="font-medium tabular-nums text-ink">{money(m.costBreakdown.ownerTimeUsd)}</dd><dd className="text-xs text-ink-3">Hours × your hourly value</dd></div>
        <div><dt className="text-xs text-ink-3">Fully loaded total</dt><dd className="font-semibold tabular-nums text-ink">{money(m.costBreakdown.fullyLoadedUsd)}</dd><dd className="text-xs text-ink-3">Cash + owner time; used for cost per customer</dd></div>
      </dl>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone={cost.kind === "assumption_scenario" ? "amber" : "neutral"}>{`Cost basis: ${COST_BASIS_LABEL[cost.kind]}`}</Badge>
        <span className="text-xs text-ink-3">Calculated at the stated point rates, outside the input-scenario range</span>
      </div>
      {top && top.switchValue !== null ? (
        <p className="text-xs text-ink-2">
          Pays back only if {top.label} is {top.direction === "ge" ? "at least" : "at most"} <span className="font-medium tabular-nums text-ink">{fmtSwitch(top, top.switchValue, money)}</span> (now {fmtSwitch(top, top.assumed, money)})
          {m.lossChance !== null && m.costUsd > 0 ? ` · ${m.lossChance > 0 && m.lossChance < 0.01 ? "under 1%" : `${Math.round(m.lossChance * 100)}%`} chance it doesn't, if its ranges are right` : ""}.
        </p>
      ) : null}
      {m.sensitivity.length ? (
        <details className="rounded-[var(--radius-control)] border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-ink">What moves this scenario?</summary>
          <p className="mt-2 text-xs text-ink-3">One input changes at a time; this is a sensitivity check, not a combined forecast. Low and high refer to the input range.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="text-left text-xs text-ink-3">
                <tr><th className="py-1 pr-3">Input</th><th className="px-2 py-1 text-right">Low</th><th className="px-2 py-1 text-right">Middle</th><th className="py-1 pl-2 text-right">High</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.sensitivity.map((row) => {
                  const value = (n: number) => row.metric === "customers" ? fmtN(n) : money(n);
                  return <tr key={row.driver}><th scope="row" className="py-1 pr-3 text-left font-medium text-ink">{row.driver}</th><td className="px-2 py-1 text-right tabular-nums">{value(row.atLow)}</td><td className="px-2 py-1 text-right tabular-nums">{value(row.atMode)}</td><td className="py-1 pl-2 text-right tabular-nums">{value(row.atHigh)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-3">Outcome shown: {m.sensitivity[0]?.metric === "customers" ? "customers" : "modeled 12-month net contribution"}. Calculated from this play&apos;s saved inputs.</p>
        </details>
      ) : null}
    </div>
  );
}

const fmtInput = (r: InputRow, currency?: string): string => {
  const n = (v: number) => {
    switch (r.unit) {
      case "share":
      case "share_month":
        return `${Math.round(v * 1000) / 10}%`;
      case "usd_month":
      case "usd_hour":
        return usd(v, currency);
      default:
        return Math.round(v).toLocaleString("en-US");
    }
  };
  const suffix = { people_week: "/week", share: "", share_month: "/month", usd_month: "/month", hours_week: " h/week", usd_hour: "/hour" }[r.unit];
  const range = r.low !== undefined && r.high !== undefined && (r.low !== r.value || r.high !== r.value) ? ` (${n(r.low)}–${n(r.high)})` : "";
  return `${n(r.value)}${suffix}${range}`;
};

const SOURCE_TONE: Record<string, Tone> = { owner: "green", research: "blue", benchmark: "neutral", planned: "brand", assumption: "amber", unlabelled: "neutral" };

/** Every number behind the play and where it came from. */
function PlayInputs({ play, economics }: { play: PlayView; economics: Economics }) {
  const rows = playInputs({ ...play, model: play.model! }, economics);
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel icon={ListChecks}>Inputs and sources</FieldLabel>
      <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-control)] border border-line">
        {rows.map((r) => (
          <li key={r.key} className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2.5 py-1.5 text-ui">
            <span className="min-w-0 text-ink-2">
              {r.label} <span className="font-semibold tabular-nums text-ink">{fmtInput(r, economics.currency)}</span>
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-1" title={r.tag.ref || undefined}>
              <Badge tone={SOURCE_TONE[r.tag.source] ?? "neutral"}>{SOURCE_LABEL[r.tag.source]}</Badge>
              {r.tag.ref && r.tag.source !== "assumption" && r.tag.check !== "owner_input" ? (
                /^https?:\/\//.test(r.tag.ref) ? (
                  <LinkChip url={r.tag.ref} />
                ) : (
                  <span className="max-w-[12rem] truncate text-xs text-ink-3">{r.tag.ref}</span>
                )
              ) : null}
              {r.tag.check ? <span className="text-xs text-ink-3">{CHECK_LABEL[r.tag.check]}</span> : null}
              {r.tag.confirmedAt ? <span className="text-xs text-ink-3">({new Date(r.tag.confirmedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })})</span> : null}
            </span>
            {(r.tag.access && r.tag.check !== "source_verified") || r.tag.replaced ? (
              <span className="basis-full text-xs text-ink-3">
                {r.tag.access && r.tag.check !== "source_verified" ? ACCESS_LABEL[r.tag.access] : ""}
                {r.tag.replaced ? `Replaced ${fmtInput({ ...r, value: r.tag.replaced.value }, economics.currency)} (${r.tag.replaced.source === "unlabelled" ? "not labelled" : r.tag.replaced.source})` : ""}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlayDetails({ play, economics, id }: { play: PlayView; economics?: Economics; id: string }) {
  const action = play.actionContract;
  const creative = play.creativeReview;
  const offer = play.offerAssessment;
  const precedentById = new Map(CREATIVE_PRECEDENTS.map((precedent) => [precedent.id, precedent]));
  return (
    <div id={id} className="flex flex-col gap-4">
      {offer ? <OfferAssessmentPanel offer={offer} /> : null}
      {creative ? (
        <section aria-label="Creative strategy reasoning" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-chart-3/30 bg-chart-3/5 p-3">
          <div className="flex flex-wrap items-center gap-2"><FieldLabel icon={Sparkles}>Why this is distinctive</FieldLabel><Badge>Exploration · not approval to execute</Badge></div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-ink-3">Default it challenges</dt><dd className="text-ui text-ink">{creative.challenge}</dd></div>
            <div><dt className="text-xs text-ink-3">What kind of default · what breaking it could cost</dt><dd className="text-ui text-ink">{creative.conventionBasis.replaceAll("_", " ")} · {creative.costOfBreaking}</dd></div>
            <div><dt className="text-xs text-ink-3">Customer tension or business asset</dt><dd className="text-ui text-ink">{creative.customerTensionOrAsset}</dd></div>
            <div><dt className="text-xs text-ink-3">Why the mechanism may transfer</dt><dd className="text-ui text-ink">{creative.transferLogic}</dd></div>
            <div><dt className="text-xs text-ink-3">Important differences</dt><dd className="text-ui text-ink">{creative.keyDifferences}</dd></div>
            <div><dt className="text-xs text-ink-3">Behavior it hopes to change</dt><dd className="text-ui text-ink">{creative.hopedCustomerBehavior}</dd></div>
            <div><dt className="text-xs text-ink-3">Assumptions</dt><dd className="text-ui text-ink">{creative.assumptions.length ? creative.assumptions.join(" · ") : "No additional assumptions listed."}</dd></div>
          </dl>
          <div>
            <p className="text-xs font-medium text-ink-2">Separate dimensions · low / medium / high</p>
            <dl className="mt-1 grid grid-cols-2 gap-2 text-ui sm:grid-cols-5">
              {(["novelty", "evidenceStrength", "businessFit", "feasibility", "risk"] as const).map((key) => <div key={key} className="rounded-[var(--radius-control)] bg-surface px-2 py-1.5"><dt className="text-xs text-ink-3">{key === "evidenceStrength" ? "Evidence" : key === "businessFit" ? "Business fit" : key[0].toUpperCase() + key.slice(1)}</dt><dd className="font-medium capitalize text-ink">{creative[key]}</dd></div>)}
            </dl>
          </div>
          {creative.precedentIds.length ? <div className="flex flex-col gap-2"><p className="text-xs font-medium text-ink-2">Retrieved precedent mechanisms</p>{creative.precedentIds.map((id) => {
            const precedent = precedentById.get(id);
            return precedent ? <article key={id} className="rounded-[var(--radius-control)] border border-line bg-surface p-2.5"><h4 className="text-ui font-semibold text-ink">{precedent.title} · {precedent.organization} <span className="font-normal text-ink-3">({id})</span></h4><p className="mt-1 text-ui text-ink-2">{precedent.mechanism} {precedent.causalLimit}</p><ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">{precedent.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="text-brand-800 underline">{source.publisher}: {source.title}</a> · {source.publicationDate}</li>)}</ul></article> : <p key={id} className="text-ui text-amber-800">Precedent reference {id} could not be resolved; treat the analogy as unverified.</p>;
          })}</div> : <p className="text-ui text-ink-2">No sufficiently relevant precedent was retrieved. This is presented as an original hypothesis and should be judged by its reversible test.</p>}
          <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-ink-3">Cheapest reversible test</dt><dd className="text-ui text-ink">{creative.reversibleTest}</dd></div><div><dt className="text-xs text-ink-3">Success signal</dt><dd className="text-ui text-ink">{creative.successSignal}</dd></div><div><dt className="text-xs text-ink-3">Guardrail</dt><dd className="text-ui text-ink">{creative.guardrail}</dd></div><div><dt className="text-xs text-ink-3">Stop condition</dt><dd className="text-ui text-ink">{creative.stopCondition}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-ink-3">Evidence that would change the recommendation</dt><dd className="text-ui text-ink">{creative.revisionEvidence}</dd></div></dl>
        </section>
      ) : null}
      {action ? (
        <section aria-label="Action and measurement plan" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FieldLabel icon={Target}>Action and measurement</FieldLabel>
            {play.actionReadiness ? (
              <Badge tone={play.actionReadiness.status === "safe_to_start" ? "green" : "amber"}>
                {play.actionReadiness.status === "safe_to_start" ? "Ready to prepare" : "Needs input first"}
              </Badge>
            ) : <Badge>Readiness not recorded</Badge>}
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-ink-3">Diagnosis</dt><dd className="text-ui text-ink">{action.diagnosis}</dd></div>
            <div><dt className="text-xs text-ink-3">Intended effect</dt><dd className="text-ui text-ink">{action.intendedEffect}</dd></div>
            <div><dt className="text-xs text-ink-3">Evidence basis</dt><dd className="text-ui text-ink">{EVIDENCE_BASIS_LABEL[action.evidenceBasis]} · {action.evidenceNote}</dd></div>
            {action.evidenceRefs.length ? <div><dt className="text-xs text-ink-3">Evidence references</dt><dd className="break-words text-ui text-ink">{action.evidenceRefs.join(" · ")}</dd></div> : null}
            <div><dt className="text-xs text-ink-3">Target or asset</dt><dd className="text-ui text-ink">{action.targetOrAsset}</dd></div>
            <div><dt className="text-xs text-ink-3">Resources</dt><dd className="text-ui text-ink">{action.resourcePlan}</dd></div>
            <div><dt className="text-xs text-ink-3">Execution</dt><dd className="text-ui text-ink">{CAPABILITY_LABEL[action.executionCapability]}</dd></div>
            <div><dt className="text-xs text-ink-3">Success measure</dt><dd className="text-ui text-ink">{action.measurement.metric} · baseline: {action.measurement.baseline} · target: {action.measurement.target} · {action.measurement.windowDays} days · source: {action.measurement.source}</dd></div>
          </dl>
          {action.dependencies.length || play.actionReadiness?.reasons.length ? (
            <div>
              <p className="text-xs font-medium text-ink-2">What needs to happen first</p>
              <ul className="mt-1 list-disc pl-5 text-ui text-ink">
                {(play.actionReadiness?.reasons.length ? play.actionReadiness.reasons : action.dependencies).map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-ink-3">This is the plan’s stated logic and measurement setup. It does not prove the action will cause the intended result.</p>
        </section>
      ) : <Callout tone="info" title="Action details not recorded">This plan predates the structured action checklist. Refreshing the plan can add its evidence basis, dependencies, and success measure.</Callout>}
      {play.model?.steps?.length ? <PlayInputs play={play} economics={economics ?? NO_ECONOMICS} /> : null}
      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={Crosshair}>How we estimate it</FieldLabel>
        <ol className="flex flex-col gap-1">
          {play.funnel.map((line, i) => {
            const grade = line.match(/\[[^\]]*,\s*([ABCD])\]/)?.[1] ?? (/assumption|grade d/i.test(line) ? "D" : null);
            const src = splitLinks(line.match(/\[([^\]]*)\]/)?.[1] ?? "");
            return (
              <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-[var(--radius-control)] bg-surface-2 px-2.5 py-1.5 text-ui text-ink">
                <span aria-hidden className="mt-px text-xs font-semibold tabular-nums text-ink-3">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  {line.replace(/\s*\[[^\]]*\]\s*$/, "")}
                  {src.text ? <span className="block text-xs text-ink-3">{src.text}</span> : null}
                  {src.urls.length ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {src.urls.map((u) => (
                        <LinkChip key={u} url={u} />
                      ))}
                    </span>
                  ) : null}
                </span>
                {grade ? (
                  <Tooltip content={GRADE[grade]}>
                    <span tabIndex={0} aria-label={GRADE[grade]} className={cn("grid size-6 place-items-center rounded-[var(--radius-badge)] text-xs font-semibold", grade === "D" ? "bg-amber-100 text-amber-800" : grade === "C" ? "bg-surface-3 text-ink-2" : "bg-green-100 text-green-800")}>
                      {grade}
                    </span>
                  </Tooltip>
                ) : null}
              </li>
            );
          })}
        </ol>
        {play.biggestUnknown ? (
          <p className="flex items-start gap-1.5 rounded-[var(--radius-control)] bg-amber-100 px-2.5 py-1.5 text-xs text-amber-800">
            <Info aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Biggest unknown: </span>
              {play.biggestUnknown}
            </span>
          </p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-line p-2.5">
          <FieldLabel icon={FlaskConical}>The test</FieldLabel>
          <p className="text-ui text-ink">{play.test}</p>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[var(--radius-control)] border border-line p-2.5">
          <FieldLabel icon={Crosshair}>Decide</FieldLabel>
          <p className="flex items-start gap-1.5 text-ui text-ink">
            <X aria-hidden className="mt-0.5 size-3.5 shrink-0 text-red-800" />
            <span>
              <span className="font-medium text-red-800">Stop if </span>
              {play.killIf}
            </span>
          </p>
          <p className="flex items-start gap-1.5 text-ui text-ink">
            <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-green-800" />
            <span>
              <span className="font-medium text-green-800">Scale if </span>
              {play.scaleIf}
            </span>
          </p>
        </div>
      </div>
      {play.climbosCanDo ? (
        <div className="flex flex-col gap-1">
          <FieldLabel icon={Sparkles}>Your team will</FieldLabel>
          <p className="text-ui text-ink">{play.climbosCanDo}</p>
        </div>
      ) : null}
    </div>
  );
}

function ScoreMeter({ scores, kind }: { scores: number[]; kind: PlayView["kind"] }) {
  const total = score(scores);
  const d = distinct(scores);
  const k = kindOf(kind);
  return (
    <Tooltip content="Weighted score: fit, predictability, leverage, speed, compounding, cost, risk. Dots: how hard to copy.">
      <span tabIndex={0} className="ml-auto flex items-center gap-2 rounded-[var(--radius-control)] text-xs text-ink-3">
        <span
          role="meter"
          aria-label="Play score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={total}
          aria-valuetext={`${total} of 100`}
          className="relative h-1.5 w-12 overflow-hidden rounded-full bg-surface-3"
        >
          <span className="absolute inset-y-0 left-0 rounded-full bg-ink-2" style={{ width: `${total}%` }} />
        </span>
        <span aria-hidden className="text-ui font-semibold tabular-nums text-ink">
          {total}
        </span>
        <span className="flex items-center gap-0.5" role="img" aria-label={`Hard to copy: ${d} of 5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} aria-hidden className={cn("size-1.5 rounded-full", i <= d ? k.rail : "bg-surface-3")} />
          ))}
        </span>
      </span>
    </Tooltip>
  );
}

/** The first complete phrase of AI text (to the first ";" / sentence end / dash), so cards never cut mid-word. */
function lead(text: string): { head: string; more: boolean } {
  const t = (text ?? "").trim();
  const m = /^(.{12,}?)(?:;\s|\.\s+(?=[A-Z“"])|\s[—–]\s|,\s(?=(?:but|and then|so|while|unless)\b))/.exec(t);
  const head = (m ? m[1] : t).replace(/[.;,]$/, "");
  return { head, more: head.length < t.replace(/[.;]$/, "").length };
}

/** Customers and similar counts: whole numbers from 10 up, one decimal below. */
const fmtN = (n: number) => (Math.abs(n) >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));

/** Shows the lead phrase; the card's Details opens the full text. */
function Lead({ text, open }: { text: string; open: boolean }) {
  const { head, more } = lead(text);
  if (open || !more) return <>{text}</>;
  return (
    <>
      {head}
      <span aria-hidden className="text-ink-3"> …</span>
      <span className="sr-only">: {text}</span>
    </>
  );
}

function Row({ icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-2">
      <dt className="pt-px">
        <FieldLabel icon={icon}>{label}</FieldLabel>
      </dt>
      <dd className="min-w-0 text-ui text-ink">{children}</dd>
    </div>
  );
}

interface ResultsCtx {
  strategyId: Id<"strategies">;
  canEdit: boolean;
  byPlay: Record<string, PlayActuals | undefined>;
}

const TARGET_TONE: Record<PlayTargets["state"], Tone> = {
  ready: "green",
  researching: "blue",
  needs_connection: "orange",
  no_contact_route: "orange",
  waiting: "neutral",
  not_started: "neutral",
  none_found: "neutral",
  failed: "red",
};

/** Named targets for a target-heavy play, with an honest state (REQ-TARGET-05, REQ-UX-02). */
function PlayTargetsBlock({ t, slug, strategyId, playId, canEdit }: { t: PlayTargets; slug: string; strategyId: Id<"strategies">; playId: string; canEdit: boolean }) {
  const start = useMutation(api.targets.startForPlay);
  const [busy, setBusy] = useState(false);
  const what = t.kind === "creators" ? "creators" : "companies";
  return (
    <section aria-label="Targets for this play" className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel icon={UsersRound}>Targets</FieldLabel>
        <Badge tone={TARGET_TONE[t.state]}>{t.label}</Badge>
        {t.counts.found ? (
          <Badge tone="brand" className="ml-auto tabular-nums">
            {`${t.counts.found} found`}
          </Badge>
        ) : null}
      </div>
      <p className="text-xs text-ink-3">{t.note}</p>
      {t.targets.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-control)] border border-line">
          {t.targets.map((x) => (
            <li key={x.id} className="flex min-w-0 flex-col gap-1 px-2.5 py-2 text-ui">
              <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 font-medium text-ink underline-offset-2 hover:underline">
                <span className="truncate">{x.handle && x.platform ? `${x.name} · ${x.platform}` : x.name}</span>
                <ExternalLink aria-hidden className="size-3 shrink-0 text-ink-3" />
              </a>
              {x.why ? (
                <Clamp lines={2} className="text-xs text-ink-3">
                  {x.why}
                </Clamp>
              ) : null}
              <span className="flex flex-wrap gap-1">
                <Badge tone={x.suppressed ? "neutral" : x.contactRoute === "email" ? "green" : "amber"}>{x.suppressed ? "Opted out" : x.contactRoute === "email" ? "Public email" : "No contact route"}</Badge>
                {x.stage !== "suggested" ? <Badge>{cap(x.stage)}</Badge> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {t.campaignId || (canEdit && t.canStart) ? (
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && t.canStart ? (
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await start({ slug, strategyId, playId });
                  toast({ tone: "success", title: `Finding ${what} for this play`, description: r.pausedSending ? "Sending on your previous campaign is paused. Resume it from Find customers." : undefined });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Search aria-hidden /> {t.state === "not_started" || t.state === "waiting" ? `Find ${what}` : "Search again"}
            </Button>
          ) : null}
          {t.campaignId ? (
            <Link href={`/app/${slug}/outbound?campaign=${t.campaignId}`} className="inline-flex min-h-8 items-center text-ui font-medium text-brand-800 underline-offset-2 hover:underline">
              See all {what}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PlayCard({ play, slug, economics, results, planId, targets, canEdit = false, diagnosis }: { play: PlayView; slug: string; economics?: Economics; results?: ResultsCtx; planId?: Id<"strategies">; targets?: PlayTargets; canEdit?: boolean; diagnosis?: Diagnosis | null }) {
  const k = kindOf(play.kind);
  const send = useMutation(api.workspace.sendChat);
  const startPlay = useMutation(api.workspace.startPlay);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const panel = useId();
  const edge = play.assetUsed ? splitLinks(play.assetUsed) : null;
  return (
    <article
      {...climbTarget("play", play.name, `${play.name} (${play.kind} play)`)}
      className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]"
    >
      <span aria-hidden className={cn("h-1", k.rail)} />
      <header className={cn("flex flex-col gap-2 border-b border-line p-4", k.band)}>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content={k.hint}>
            <span tabIndex={0} className={cn("inline-flex items-center gap-1.5 rounded-[var(--radius-control)] text-xs font-semibold", k.ink)}>
              <span aria-hidden className={cn("grid size-6 place-items-center rounded-[var(--radius-control)]", k.tile)}>
                <k.icon className="size-3.5" />
              </span>
              {k.label}
            </span>
          </Tooltip>
          <ScoreMeter scores={play.scores} kind={play.kind} />
        </div>
        <h3 className="heading-card">{play.name}</h3>
        <p className="text-ui text-ink-2">
          <Lead text={play.oneLiner} open={open} />
        </p>
        {play.offerAssessment ? <p className="text-xs text-ink-3">Offer decision: {play.offerAssessment.recommendation.replaceAll("_", " ")} · {play.offerAssessment.mechanism.replaceAll("_", " ")} · owner approval required</p> : null}
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <figure className={cn("rounded-r-[var(--radius-control)] border-l-2 bg-surface-2 px-3 py-2", k.quote)}>
          <figcaption className="text-overline mb-0.5">Hook</figcaption>
          <blockquote className="font-display text-sm italic leading-snug text-ink">
            “<Lead text={play.hook.replace(/^[“"]|[”"]$/g, "")} open={open} />”
          </blockquote>
        </figure>
        <dl className="flex flex-col gap-2">
          <Row icon={UsersRound} label="Who">
            <Lead text={play.audience} open={open} />
          </Row>
          <Row icon={CalendarClock} label="When">
            <Lead text={play.trigger} open={open} />
          </Row>
          {play.timingAssessment && play.timingAssessment.decision !== "not_relevant" ? (
            <CampaignTimingSummary timing={play.timingAssessment} />
          ) : null}
          {edge ? (
            <Row icon={Zap} label="Edge">
              <Lead text={edge.text || play.assetUsed} open={open} />
              {edge.urls.length ? (
                <span className="mt-1 flex flex-wrap gap-1">
                  {edge.urls.map((u) => (
                    <LinkChip key={u} url={u} />
                  ))}
                </span>
              ) : null}
            </Row>
          ) : null}
          {play.route ? (
            <Row icon={Megaphone} label="Route">
              <Lead text={play.route} open={open} />
            </Row>
          ) : null}
        </dl>

        <Forecast f={play} economics={economics} open={open} diagnosis={diagnosis} />
        {play.model && economics ? <PlayEconomics play={play} economics={economics} /> : null}
        {targets && planId && play.id ? <PlayTargetsBlock t={targets} slug={slug} strategyId={planId} playId={play.id} canEdit={canEdit} /> : null}
        {play.model?.steps?.length && results ? <PlayResults slug={slug} strategyId={results.strategyId} playName={play.name} model={play.model} actuals={results.byPlay[play.name]} canEdit={results.canEdit} /> : null}

        {open ? <PlayDetails play={play} economics={economics} id={panel} /> : null}

        <div className="mt-auto flex flex-col gap-2.5 rounded-[var(--radius-card)] bg-cream-soft p-3">
          <p className="text-overline flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-3.5" /> Today
          </p>
          <Clamp lines={2} toggle={false} expanded={open} className="text-ui text-ink">
            {play.firstActionToday}
          </Clamp>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  // Structured IDs when the play has one (REQ-UX-03); older plays fall back to the text request.
                  if (planId && play.id) await startPlay({ slug, strategyId: planId, playId: play.id });
                  else await send({ slug, text: `Start the "${play.name}" play: ${play.oneLiner} Audience: ${play.audience}. Hook: ${play.hook}. Prepare everything your team can do for it now: ${play.climbosCanDo}` });
                  router.push(`/app/${slug}/today`);
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Magic aria-hidden /> Make it happen
            </Button>
            <DetailsToggle open={open} onToggle={() => setOpen((v) => !v)} label="Details" controls={panel} />
            {canEdit && planId ? <FeedbackButton slug={slug} strategyId={planId} subjectKind="play" subjectKey={play.id ?? play.name} subjectLabel={play.name} /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------------- Plays comparison chart ---------------- */

/** Lower/upper input scenarios and the stated-input point per play on one axis. */
function PlayRangeChart({ plays, economics }: { plays: PlayView[]; economics?: Economics }) {
  const nav = useKeyNav(plays.length, 1);
  const scale = niceScale(Math.max(...plays.map((p) => p.p90), 1));
  const at = (v: number) => Math.min(100, Math.max(0, (v / scale.max) * 100));
  const label = "Forecast per play: lower scenario, point at stated inputs, and upper scenario";
  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        tabIndex={0}
        aria-label={`${label}. Arrow keys read each play.`}
        onKeyDown={nav.onKeyDown}
        onBlur={nav.onBlur}
        onMouseLeave={nav.onMouseLeave}
        className={cn("flex flex-col gap-1.5 rounded-[2px]", focusRing)}
      >
        {plays.map((p, i) => {
          const k = kindOf(p.kind);
          const on = nav.active === i;
          const cac = p.model && economics ? playMaths({ ...p, model: p.model }, economics).cacUsd : null;
          return (
            <div
              key={p.name}
              onMouseEnter={() => nav.setActive(i)}
              className={cn("grid grid-cols-1 gap-x-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-center", nav.active !== null && !on && "opacity-50")}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-ui text-ink">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", k.rail)} />
                <span className="truncate">{p.name}</span>
              </span>
              <div className="relative h-8">
                {scale.ticks.slice(1, -1).map((t) => (
                  <span key={t} aria-hidden className="absolute inset-y-0 border-l border-dashed border-line" style={{ left: `${at(t)}%` }} />
                ))}
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
                <span aria-hidden className={cn("absolute top-1/2 h-3 -translate-y-1/2 rounded-full", k.soft)} style={{ left: `${at(p.p10)}%`, width: `${Math.max(1, at(p.p90) - at(p.p10))}%` }} />
                <span aria-hidden className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2", k.rail, on ? "ring-ink" : "ring-surface")} style={{ left: `${at(p.p50)}%` }} />
                {on ? (
                  <ChartTooltip
                    place={i === 0 ? "below" : "above"}
                    tip={{
                      x: at(p.p50),
                      y: i === 0 ? 100 : 0,
                      title: p.name,
                      rows: [
                        { label: "Lower scenario", value: String(p.p10), color: k.chart, shape: "dot" },
                        { label: "At stated inputs", value: String(p.p50), color: k.chart, shape: "dot", strong: true },
                        { label: "Upper scenario", value: String(p.p90), color: k.chart, shape: "dot" },
                        ...(cac !== null ? [{ label: "Cost / customer", value: usd(cac, economics?.currency) }] : []),
                      ],
                      note: `${kindOf(p.kind).label} · ${CONFIDENCE[p.confidence]?.label ?? p.confidence} · ${p.horizonDays} days`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="sm:ml-[calc(12rem+0.75rem)]">
        <XTicks ticks={scale.ticks} at={at} />
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-5 rounded-full bg-surface-3" /> Lower-to-upper scenario range
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-ink-2" /> Point at stated inputs
        </span>
        <span>New customers in {plays[0]?.horizonDays ?? 90} days</span>
      </p>
      <SrTable caption={label} columns={["Play", "Lower scenario", "At stated inputs", "Upper scenario", "Unit"]} rows={plays.map((p) => [p.name, p.p10, p.p50, p.p90, p.unit])} />
    </div>
  );
}

function PlaysChart({ plays, economics }: { plays: PlayView[]; economics?: Economics }) {
  const [view, setView] = useState<"range" | "cost">("range");
  const points = economics
    ? plays.flatMap((p) => {
        if (!p.model?.steps?.length) return [];
        const m = playMaths({ ...p, model: p.model }, economics);
        return m.cacUsd === null ? [] : [{ label: p.name, x: p.p50, y: Math.round(m.cacUsd), group: p.kind }];
      })
    : [];
  const kinds = Array.from(new Set(plays.map((p) => p.kind)));
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-overline">{view === "range" ? "Expected customers per play" : "Cost per customer vs customers"}</p>
          {points.length ? (
            <Segmented
              label="Chart view"
              value={view}
              onChange={setView}
              options={[
                { value: "range", label: "Customers" },
                { value: "cost", label: "Cost" },
              ]}
            />
          ) : null}
        </div>
        {view === "cost" && points.length ? (
          <ScatterPlot
            label="Cost per customer against expected customers, per play"
            points={points}
            groups={kinds.map((k) => ({ key: k, label: KIND[k].label, color: KIND[k].chart }))}
            xLabel="Expected customers"
            yLabel="Cost per customer"
            formatY={(n) => usd(n, economics?.currency)}
            height={200}
          />
        ) : null}
        {view === "cost" && points.length ? (
          <p className="text-xs text-ink-3">Lower right is better: more customers, cheaper each.</p>
        ) : (
          <PlayRangeChart plays={plays} economics={economics} />
        )}
      </CardContent>
    </Card>
  );
}

/** The unit economics every play's numbers rest on, with what's assumed called out (spec §25). */
function EconomicsLine({ economics: e }: { economics: Economics }) {
  const churn = churnOf(e);
  const src = economicsSources(e);
  const part = (label: string, value: string, key: keyof typeof src) => {
    const s = src[key];
    const assumed = s.source === "assumption";
    return (
      <li
        key={label}
        title={s.ref || undefined}
        className={cn("inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-badge)] px-2 text-xs", assumed ? "bg-amber-100 text-amber-800" : "bg-surface-2 text-ink-2")}
      >
        {assumed ? <TriangleAlert aria-hidden className="size-3 shrink-0" /> : null}
        {label} <span className="font-semibold tabular-nums text-ink">{value}</span>
        <span>
          · {SOURCE_LABEL[s.source].toLowerCase()}
          {s.check && s.check !== "owner_input" ? `, ${CHECK_LABEL[s.check]}` : ""}
        </span>
      </li>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-ink-3">Costed on</span>
      <ul className="flex flex-wrap gap-1.5">
        {part("Revenue", `${formatMoney(Math.round(e.revenuePerCustomerMonthUsd * 100) / 100, e.currency)}/mo`, "revenue")}
        {part("Margin", `${Math.round(e.grossMargin > 1 ? e.grossMargin : e.grossMargin * 100)}%`, "margin")}
        {churn !== null ? part("Churn", `${Math.round(churn * 1000) / 10}%/mo`, "churn") : null}
        {part("Your time", `${usd(ownerHourOf(e), e.currency)}/h`, "ownerHour")}
      </ul>
    </div>
  );
}

function PortfolioObjectiveCard({ label, explanation, choice, noChoice, economics, days }: { label: string; explanation: string; choice: PortfolioChoice | null; noChoice: string; economics?: Economics; days: number }) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        <p className="mt-1 text-xs text-ink-3">{explanation}</p>
      </div>
      {!choice ? <p className="text-ui text-ink-2">{noChoice}</p> : (
        <>
          <div>
            <p className="text-xs text-ink-3">Selected set · {days} days</p>
            <ul className="mt-1 list-disc pl-5 text-ui font-medium text-ink">{choice.selected.map((name) => <li key={name}>{name}</li>)}</ul>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-ink-3">Modeled customers</dt><dd className="font-semibold tabular-nums text-ink">{fmtN(choice.customers)} at stated rates · {fmtN(choice.expectedCustomers)} average across modeled scenarios</dd></div>
            <div><dt className="text-xs text-ink-3">Cash costs and time</dt><dd className="font-semibold tabular-nums text-ink">{usd(choice.spendUsdMonth, economics?.currency)}/mo media · {usd(choice.cashSpendUsdMonth, economics?.currency)}/mo total cash · {fmtN(choice.ownerHoursWeek)} h/wk</dd></div>
            {choice.netUsd !== null ? <div><dt className="text-xs text-ink-3">Modeled net contribution over this period</dt><dd className="font-semibold tabular-nums text-ink">{usd(choice.netUsd, economics?.currency)}</dd></div> : null}
            <div><dt className="text-xs text-ink-3">Limits</dt><dd className="font-medium text-ink">{choice.allFit ? "Fits supplied cash, ad budget and capacity limits" : "Some drafted plays do not fit supplied cash, ad budget or capacity limits"}</dd></div>
          </dl>
          {choice.runnerUp ? <p className="text-xs text-ink-3">Closest alternative: {choice.runnerUp.selected.join(" + ") || "No play"} · {fmtN(choice.runnerUp.customers)} customers at stated rates.</p> : null}
          {choice.left.length ? <details className="text-xs text-ink-3"><summary className="cursor-pointer font-medium text-ink-2">Why other plays were left out ({choice.left.length})</summary><ul className="mt-1 list-disc pl-5">{choice.left.map((item, i) => <li key={`${item.name}-${i}`}>{item.name}: {item.why}</li>)}</ul></details> : null}
        </>
      )}
    </article>
  );
}

function PortfolioComparisons({ data, economics }: { data: NonNullable<ExpertView["portfolioComparisons"]>; economics?: Economics }) {
  return (
    <section aria-label="Compare growth plans under two outcome definitions" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface-2 p-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">Which set fits the goal?</h3>
        <p className="mt-1 text-xs text-ink-3">Both comparisons use the supplied budget, team time, delivery capacity, and {data.horizonDays}-day goal period. These are modeled scenarios, not guaranteed outcomes.</p>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <PortfolioObjectiveCard
          label="Play-attributed customers"
          explanation="Counts customers modeled through each play’s funnel. It does not subtract what might happen without the play."
          choice={data.playAttributed}
          noChoice="No feasible play set fits the current modeled limits."
          economics={economics}
          days={data.horizonDays}
        />
        <PortfolioObjectiveCard
          label="Modeled improvement over baseline"
          explanation="Subtracts the supplied baseline rates to estimate change. This is not experimentally proven lift."
          choice={data.modeledIncremental}
          noChoice={data.baselinePlayCount ? "No feasible set uses the available baseline-based play inputs." : "Not estimated: none of the modeled plays includes a baseline rate."}
          economics={economics}
          days={data.horizonDays}
        />
      </div>
      {data.baselinePlayCount > 0 && data.baselinePlayCount < data.modeledPlayCount ? <p className="text-xs text-ink-3">Baseline comparison covers {data.baselinePlayCount} of {data.modeledPlayCount} modeled plays; the rest cannot be included in that objective.</p> : null}
    </section>
  );
}

type ExplorationMode = "grounded" | "adjacent" | "bold";
type ExplorationDecision = "considering" | "selected" | "rejected" | "edited";
type ExplorationTestState = "not_started" | "designed" | "executed" | "observed" | "unknown";
type ExplorationEvidence = "measured" | "owner_reported" | "source_reported" | "inferred" | "unknown";
type ExplorationFeedbackDraft = { decision: ExplorationDecision; ownerEdit: string; testState: ExplorationTestState; outcomeNote: string; outcomeEvidence: ExplorationEvidence };
const EMPTY_EXPLORATION_FEEDBACK: Record<ExplorationMode, ExplorationFeedbackDraft> = {
  grounded: { decision: "considering", ownerEdit: "", testState: "not_started", outcomeNote: "", outcomeEvidence: "unknown" },
  adjacent: { decision: "considering", ownerEdit: "", testState: "not_started", outcomeNote: "", outcomeEvidence: "unknown" },
  bold: { decision: "considering", ownerEdit: "", testState: "not_started", outcomeNote: "", outcomeEvidence: "unknown" },
};

function StrategyExplorationPanel({ options, slug, strategyId, canEdit }: { options: StrategyExploration; slug: string; strategyId?: Id<"strategies">; canEdit: boolean }) {
  const saved = useQuery(api.creativeStrategy.feedbackForStrategy, strategyId ? { slug, strategyId } : "skip");
  const recordFeedback = useMutation(api.creativeStrategy.recordFeedback);
  const [drafts, setDrafts] = useState<Record<ExplorationMode, ExplorationFeedbackDraft>>(() => structuredClone(EMPTY_EXPLORATION_FEEDBACK));
  const [saving, setSaving] = useState<ExplorationMode | null>(null);
  const update = (mode: ExplorationMode, patch: Partial<ExplorationFeedbackDraft>) => setDrafts((current) => ({ ...current, [mode]: { ...current[mode], ...patch } }));
  const submit = async (mode: ExplorationMode) => {
    if (!strategyId) return;
    const draft = drafts[mode];
    if (draft.decision === "edited" && !draft.ownerEdit.trim()) {
      toast({ tone: "info", title: "Describe your version first" });
      return;
    }
    if (draft.testState === "observed" && !draft.outcomeNote.trim()) {
      toast({ tone: "info", title: "Add the result or mark it unknown" });
      return;
    }
    setSaving(mode);
    try {
      await recordFeedback({ slug, strategyId, mode, decision: draft.decision, ownerEdit: draft.ownerEdit.trim() || undefined, testState: draft.testState, outcomeNote: draft.outcomeNote.trim() || undefined, outcomeEvidence: draft.testState === "unknown" ? "unknown" : draft.outcomeEvidence });
      setDrafts((current) => ({ ...current, [mode]: { ...EMPTY_EXPLORATION_FEEDBACK[mode] } }));
      toast({ tone: "success", title: "Saved for this workspace" });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally {
      setSaving(null);
    }
  };
  const previous = saved?.feedback as Partial<Record<ExplorationMode, { decision: string; ownerEdit: string; testState: string; outcomeNote: string; outcomeEvidence: string }>> | undefined;
  const entries = [
    { key: "grounded" as const, mode: "Grounded", description: "The strongest available evidence and practical constraints.", value: options.grounded },
    { key: "adjacent" as const, mode: "Adjacent", description: "A transfer or combination from a less familiar mechanism.", value: options.adjacent },
    { key: "bold" as const, mode: "Bold", description: "An original, higher-uncertainty hypothesis; no direct precedent is required.", value: options.bold },
  ];
  return (
    <section aria-label="Grounded, adjacent and bold strategy options" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-chart-3/30 bg-chart-3/5 p-3">
      <div>
        <div className="flex flex-wrap items-center gap-2"><FieldLabel icon={Sparkles}>Three strategy options</FieldLabel><Badge>Exploration · not an execution ranking</Badge></div>
        <p className="mt-1 text-sm text-ink-2">Evidence, novelty, business fit, feasibility and risk stay separate. A bold option remains visible even when evidence or immediate feasibility is low. Requested range: {(options.requestedRange ?? "balanced").replaceAll("_", " ")}.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {entries.map(({ key, mode, description, value }) => (
          <article key={mode} className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2"><Badge>{mode}</Badge><span className="text-xs text-ink-3">{value.evidenceBasis.replaceAll("_", " ")}</span></div>
            <h3 className="heading-card">{value.title}</h3>
            <p className="text-xs text-ink-3">{description}</p>
            <dl className="grid gap-2 text-ui">
              <div><dt className="text-xs text-ink-3">What it challenges</dt><dd className="text-ink">{value.challengedConvention}</dd></div>
              <div><dt className="text-xs text-ink-3">Why it is the default · cost of breaking it</dt><dd className="text-ink">{value.whyConventionPersists} {value.costOfBreaking}</dd></div>
              <div><dt className="text-xs text-ink-3">Business mechanism</dt><dd className="text-ink">{value.businessMechanism}</dd></div>
              <div><dt className="text-xs text-ink-3">What the business would do</dt><dd className="text-ink">{value.businessAction}</dd></div>
              <div><dt className="text-xs text-ink-3">Customer behavior sought</dt><dd className="text-ink">{value.customerBehavior}</dd></div>
              <div><dt className="text-xs text-ink-3">Possible upside · hypothesis</dt><dd className="text-ink">{value.whyItCouldMatter}</dd></div>
              <div><dt className="text-xs text-ink-3">Audience or condition</dt><dd className="text-ink">{value.audienceOrCondition}</dd></div>
              <div><dt className="text-xs text-ink-3">Evidence and precedent transfer</dt><dd className="text-ink">{value.evidenceNote}{value.precedentIds.length ? ` · Cases: ${value.precedentIds.join(", ")}` : " · No matching precedent used"} {value.transferLogic} Differences: {value.keyDifferences}</dd>{value.precedentIds.length || value.evidenceRefs.length ? <ul className="mt-1 list-disc pl-4">{value.precedentIds.flatMap((id) => { const precedent = CREATIVE_PRECEDENTS.find((item) => item.id === id); return precedent ? precedent.sources.map((source) => <li key={`${id}:${source.url}`}><a className="text-link underline" href={source.url} target="_blank" rel="noreferrer">{id}: {source.title} · {source.publisher} · {source.publicationDate}<ExternalLink aria-hidden className="ml-1 inline size-3" /></a><span className="text-xs text-ink-3"> — supports: {source.supports}</span></li>) : []; })}{value.evidenceRefs.map((ref) => <li key={ref}>{/^https:\/\//i.test(ref) ? <a className="text-link underline" href={ref} target="_blank" rel="noreferrer">Source <ExternalLink aria-hidden className="inline size-3" /></a> : ref}</li>)}</ul> : null}</div>
            </dl>
            <div>
              <p className="text-xs font-medium text-ink-2">Separate dimensions · low / medium / high</p>
              <dl className="mt-1 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
                {(["novelty", "evidenceStrength", "businessFit", "feasibility", "risk"] as const).map((key) => <div key={key} className="rounded-[var(--radius-control)] bg-surface-2 px-2 py-1"><dt className="text-ink-3">{key === "evidenceStrength" ? "Evidence" : key === "businessFit" ? "Business fit" : key[0].toUpperCase() + key.slice(1)}</dt><dd className="font-medium capitalize text-ink">{value[key]}</dd></div>)}
              </dl>
            </div>
            <div className="mt-auto border-t border-line pt-2 text-ui">
              <p className="text-xs font-medium text-ink-2">Small reversible test</p>
              <p className="text-ink">{value.reversibleTest.method}</p>
              <p className="mt-1 text-xs text-ink-3">Measure: {value.reversibleTest.metric} · {value.reversibleTest.duration} · {value.reversibleTest.resourceLimit}</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-ink-2">
                <li>Continue if: {value.reversibleTest.continueIf}</li>
                <li>Change if: {value.reversibleTest.changeIf}</li>
                <li>Stop if: {value.reversibleTest.stopIf}</li>
              </ul>
              {value.assumptions.length || value.uncertainties.length || value.risks.length ? <p className="mt-2 text-xs text-ink-3">Assumptions: {value.assumptions.join(" · ") || "None listed"}. Unknowns: {value.uncertainties.join(" · ") || "None listed"}. Risks: {value.risks.join(" · ") || "None listed"}. Resources: {value.costAndCapacity}</p> : null}
            </div>
            {previous?.[key] ? <p className="rounded bg-surface-2 p-2 text-xs text-ink-2">Last owner record: {previous[key]!.decision}; test {previous[key]!.testState}; outcome evidence {previous[key]!.outcomeEvidence}{previous[key]!.ownerEdit ? `. Owner edit: ${previous[key]!.ownerEdit}` : ""}{previous[key]!.outcomeNote ? `. Outcome: ${previous[key]!.outcomeNote}` : previous[key]!.testState === "unknown" ? ". Outcome unknown." : ""}</p> : null}
            {canEdit && strategyId ? <div className="flex flex-col gap-2 border-t border-line pt-2">
              <Field label="Your decision"><Select value={drafts[key].decision} onValueChange={(choice) => update(key, { decision: choice as ExplorationDecision })} options={[{ value: "considering", label: "Still considering" }, { value: "selected", label: "Select this option" }, { value: "rejected", label: "Reject this option" }, { value: "edited", label: "I changed it" }]} /></Field>
              <Field label="Your edit or reason" hint={drafts[key].decision === "edited" ? "Required to preserve the changed version separately." : "Optional owner note."}><Textarea value={drafts[key].ownerEdit} onChange={(event) => update(key, { ownerEdit: event.target.value.slice(0, 2_000) })} maxLength={2_000} rows={2} /></Field>
              <Field label="Test progress"><Select value={drafts[key].testState} onValueChange={(choice) => update(key, { testState: choice as ExplorationTestState, ...(choice === "unknown" ? { outcomeEvidence: "unknown" as const } : {}) })} options={[{ value: "not_started", label: "Not started" }, { value: "designed", label: "Test designed" }, { value: "executed", label: "Test run" }, { value: "observed", label: "Outcome recorded" }, { value: "unknown", label: "Outcome unknown" }]} /></Field>
              {drafts[key].testState === "observed" ? <><Field label="Outcome evidence"><Select value={drafts[key].outcomeEvidence} onValueChange={(evidence) => update(key, { outcomeEvidence: evidence as ExplorationEvidence })} options={[{ value: "measured", label: "Measured" }, { value: "owner_reported", label: "Owner reported" }, { value: "source_reported", label: "Source reported" }, { value: "inferred", label: "Inferred" }, { value: "unknown", label: "Unknown" }]} /></Field><Field label="Observed outcome" hint="State the measure and period when known; leave causality unclaimed."><Textarea value={drafts[key].outcomeNote} onChange={(event) => update(key, { outcomeNote: event.target.value.slice(0, 1_500) })} maxLength={1_500} rows={2} /></Field></> : null}
              <Button size="sm" variant="secondary" disabled={saving !== null || (drafts[key].decision === "edited" && !drafts[key].ownerEdit.trim()) || (drafts[key].testState === "observed" && !drafts[key].outcomeNote.trim())} onClick={() => void submit(key)}>{saving === key ? "Saving…" : "Save owner feedback"}</Button>
            </div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function GrowthPlays({ plays, slug, economics, portfolioComparisons, strategyExploration, strategyId, planId, canEdit = false, focused = false, diagnosis }: { plays: PlayView[]; slug: string; economics?: Economics; portfolioComparisons?: ExpertView["portfolioComparisons"]; strategyExploration?: StrategyExploration; strategyId?: Id<"strategies">; planId?: Id<"strategies">; canEdit?: boolean; focused?: boolean; diagnosis?: Diagnosis | null }) {
  const byPlay = useQuery(api.playResults.forStrategy, strategyId ? { slug, strategyId } : "skip");
  // plan_targets workspaces only (null otherwise): named targets per play.
  const targets = useQuery(api.targets.forStrategy, planId ? { slug, strategyId: planId } : "skip");
  if (!plays.length && !strategyExploration) return null;
  const results = strategyId ? { strategyId, canEdit, byPlay: (byPlay ?? {}) as Record<string, PlayActuals | undefined> } : undefined;
  const order = { bankable: 0, creative: 1, moonshot: 2 } as const;
  const sorted = [...plays].sort((a, b) => order[a.kind] - order[b.kind]);
  const counts = (Object.keys(KIND) as PlayView["kind"][]).map((k) => ({ k, n: plays.filter((p) => p.kind === k).length })).filter((c) => c.n);
  return (
    <PlanSection
      id="plays"
      title="Growth plays"
      icon={Rocket}
      intro={focused ? "Aimed at the constraint. Tested first." : "Tested before they scale."}
      bare
      meta={counts.map(({ k, n }) => {
        const K = KIND[k];
        return (
          <span key={k} className={cn("inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-badge)] px-2 text-xs font-medium", K.band, K.ink)}>
            <K.icon aria-hidden className="size-3" />
            {n} {K.label.toLowerCase()}
          </span>
        );
      })}
    >
      {strategyExploration ? <StrategyExplorationPanel options={strategyExploration} slug={slug} strategyId={planId} canEdit={canEdit} /> : null}
      {economics ? <EconomicsLine economics={economics} /> : null}
      {portfolioComparisons ? <PortfolioComparisons data={portfolioComparisons} economics={economics} /> : null}
      {sorted.length > 1 ? <PlaysChart plays={sorted} economics={economics} /> : null}
      <div className={cn("grid gap-3", sorted.length > 2 ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")}>
        {sorted.map((p) => (
          <PlayCard key={p.name} play={p} slug={slug} economics={economics} results={results} planId={planId} targets={p.id ? targets?.[p.id] : undefined} canEdit={canEdit} diagnosis={diagnosis} />
        ))}
      </div>
    </PlanSection>
  );
}

/* ---------------- Execution plan ---------------- */

const PHASE_COLOR = [
  { bar: "bg-chart-1", soft: "bg-chart-1/10" },
  { bar: "bg-chart-3", soft: "bg-chart-3/10" },
  { bar: "bg-chart-4", soft: "bg-chart-4/10" },
  { bar: "bg-chart-5", soft: "bg-chart-5/10" },
  { bar: "bg-chart-2", soft: "bg-surface-2" },
];

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "Days 15–45" → [15, 45]. */
const dayRange = (s: string): [number, number] | null => {
  const m = /(\d+)\s*(?:[–—-]|to)\s*(\d+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/** Day 0 → 90 strip: coloured segments per phase; hover or focus a phase to highlight it. */
function PhaseStrip({ phases }: { phases: ExpertView["phases"] }) {
  const [active, setActive] = useState<number | null>(null);
  const ranges = phases.map((p) => dayRange(p.days));
  const ok = ranges.every(Boolean) && ranges.length > 0;
  const start = ok ? Math.min(...ranges.map((r) => r![0])) : 0;
  const end = ok ? Math.max(...ranges.map((r) => r![1])) : phases.length;
  const span = Math.max(1, end - start);
  const seg = (i: number) => (ok ? { left: ((ranges[i]![0] - start) / span) * 100, width: ((ranges[i]![1] - ranges[i]![0]) / span) * 100 } : { left: (i / phases.length) * 100, width: 100 / phases.length });
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="relative h-3 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`Timeline: ${phases.map((p) => `${p.name}, ${p.days}`).join("; ")}`}>
          {phases.map((p, i) => {
            const s = seg(i);
            return (
              <span
                key={p.name}
                aria-hidden
                className={cn("absolute inset-y-0 border-r-2 border-surface transition-opacity duration-[var(--dur-base)]", PHASE_COLOR[i % PHASE_COLOR.length].bar, active !== null && active !== i && "opacity-30")}
                style={{ left: `${s.left}%`, width: `${Math.max(2, s.width)}%` }}
              />
            );
          })}
        </div>
        {ok ? (
          <div aria-hidden className="mt-1 flex justify-between text-2xs tabular-nums text-ink-3">
            <span>Day {start}</span>
            <span>Day {end}</span>
          </div>
        ) : null}
      </div>
      <ol className={cn("grid gap-2", phases.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {phases.map((p, i) => {
          const c = PHASE_COLOR[i % PHASE_COLOR.length];
          return (
            <li
              key={p.name}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={cn("flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-card)] p-3", c.soft)}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-[var(--radius-badge)] text-2xs font-semibold text-white", c.bar)}>
                  {i + 1}
                </span>
                <span className="text-ui font-semibold text-ink">{p.name}</span>
                <Badge className="bg-surface">{p.days}</Badge>
              </span>
              <ProseBullets text={cap(p.focus.replace(new RegExp(`^${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*`, "i"), ""))} max={1} tone="muted" />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "Do X; then Y" → bold "Do X" + the rest. */
function headOf(s: string): [string, string] {
  const semi = s.search(/[;:]\s/);
  if (semi > 8) return [s.slice(0, semi), s.slice(semi + 1).trim()];
  const comma = s.search(/,\s/);
  if (comma > 12 && comma < 70) return [s.slice(0, comma), s.slice(comma + 1).trim()];
  return [s, ""];
}

function NotDoing({ items }: { items: ExpertView["notDoing"] }) {
  const [open, setOpen] = useState<number | null>(null);
  const why = useId();
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5">
        {items.map((n, i) => (
          <li key={n.channel}>
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls={open === i ? why : undefined}
              onClick={() => setOpen((o) => (o === i ? null : i))}
              className={cn(
                "inline-flex min-h-7 items-center gap-1.5 rounded-[var(--radius-badge)] border px-2 text-xs text-ink-2 hover:text-ink",
                open === i ? "border-line-strong bg-surface" : "border-transparent bg-surface-2",
              )}
            >
              <Ban aria-hidden className="size-3 shrink-0 text-ink-3" />
              <span className="line-through decoration-ink-3">{n.channel}</span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null && items[open] ? (
        <p id={why} className="rounded-[var(--radius-control)] bg-surface-2 px-2.5 py-2 text-ui text-ink-2">
          <span className="font-medium text-ink">{items[open].channel}: </span>
          {items[open].why}
        </p>
      ) : null}
    </div>
  );
}

export function ExecutionPlan({ expert }: { expert: ExpertView }) {
  const [weekAll, setWeekAll] = useState(false);
  const [riskAll, setRiskAll] = useState(false);
  return (
    <PlanSection id="execution-heading" title="Execution plan" navLabel="Execution" icon={CalendarDays} bare>
      {expert.phases.length ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-overline">Phases</p>
            <PhaseStrip phases={expert.phases} />
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3">
        <Card>
          <CardContent className="flex flex-col gap-2.5">
            <p className="text-overline flex items-center gap-1.5">
              <ListChecks aria-hidden className="size-3.5" /> This week
              <Badge className="normal-case tracking-normal">{`${expert.weekOneChecklist.length} steps`}</Badge>
              <span className="ml-auto">
                <ExpandAll open={weekAll} onToggle={() => setWeekAll((v) => !v)} />
              </span>
            </p>
            <ol className="flex flex-col gap-2">
              {expert.weekOneChecklist.map((w, i) => {
                const [head, rest] = headOf(w);
                return (
                  <li key={i} className="flex min-w-0 items-start gap-2.5">
                    <span aria-hidden className="mt-px grid size-5 shrink-0 place-items-center rounded-[var(--radius-control)] border-[1.5px] border-control text-2xs font-semibold tabular-nums text-ink-2">
                      {i + 1}
                    </span>
                    <Clamp lines={1} toggle={false} expanded={weekAll} className="flex-1 text-ui">
                      <span className="font-medium text-ink">{head}</span>
                      {rest ? <span className="text-ink-3">: {rest}</span> : null}
                    </Clamp>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
        {expert.risks.length ? (
          <Card>
            <CardContent className="flex flex-col gap-2.5">
              <p className="text-overline flex items-center gap-1.5">
                <TriangleAlert aria-hidden className="size-3.5" /> Risks → mitigations
                <Badge tone="amber" className="normal-case tracking-normal">{`${expert.risks.length} risks`}</Badge>
                <span className="ml-auto">
                  <ExpandAll open={riskAll} onToggle={() => setRiskAll((v) => !v)} />
                </span>
              </p>
              <ul className="flex flex-col gap-2">
                {expert.risks.map((r) => (
                  <li key={r.risk} className="grid min-w-0 gap-px overflow-hidden rounded-[var(--radius-control)] border border-line sm:grid-cols-2">
                    <div className="flex min-w-0 items-start gap-1.5 bg-amber-100 px-2.5 py-2">
                      <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-800" />
                      <span className="sr-only">Risk: </span>
                      <Clamp lines={1} toggle={false} expanded={riskAll} className="flex-1 text-ui text-ink">
                        {r.risk}
                      </Clamp>
                    </div>
                    <div className="flex min-w-0 items-start gap-1.5 bg-green-100 px-2.5 py-2">
                      <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-green-800" />
                      <span className="sr-only">Mitigation: </span>
                      <Clamp lines={1} toggle={false} expanded={riskAll} className="flex-1 text-ui text-ink">
                        {r.mitigation}
                      </Clamp>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
      {expert.notDoing.length ? (
        <Card>
          <CardContent className="flex flex-col gap-2.5">
            <p className="text-overline flex items-center gap-1.5">
              <Ban aria-hidden className="size-3.5" /> Not doing, on purpose
            </p>
            <NotDoing items={expert.notDoing} />
          </CardContent>
        </Card>
      ) : null}
    </PlanSection>
  );
}
