"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { RefreshCw } from "@/components/icons"
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, ConfirmDialog, Field, Input, Select, Textarea, buttonClasses, toast } from "@/components/ui";
import { can } from "@shared/policy";
import { AiModePicker, useAiMode } from "../AiModePicker";
import { RetryRunIfPossible, RUN_FINISHED, RunProgress } from "../content/RunProgress";
import { PERMISSION_WHO, majorToDisplay, type MemberRole } from "../content/shared";
import { errorMessage } from "../errors";
import { microsToCreditsLabel, relativeTime } from "../money";
import { BUSINESS_TYPE_OPTIONS, CURRENCY_OPTIONS, GOAL_KIND_OPTIONS, HORIZON_OPTIONS, REVIEW_DAY_OPTIONS, defaultEvents, goalDefaults, type BusinessType, type GoalKind } from "../onboarding/options";
import { LoadingBlock } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";

type State = NonNullable<ReturnType<typeof useQuery<typeof api.orgs.onboardingState>>>;

/** Settings → Business & goal: everything onboarding asked, editable any time, plus a research refresh. */
export function BusinessGoalSettings({ slug }: { slug: string }) {
  const state = useQuery(api.orgs.onboardingState, { slug });
  if (state === undefined) return <LoadingBlock label="Loading your business and goal" lines={5} />;
  const role = state.role as MemberRole;
  const canEdit = can(role, "edit");
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Business & goal"
        actions={
          <Link href={`/app/${slug}/plan`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Open plan
          </Link>
        }
      />
      {!canEdit ? <Callout tone="info">Changing these needs {PERMISSION_WHO.edit}.</Callout> : null}
      <GoalForm key={`${state.goal?.statement ?? ""}-${state.goal?.monthlyAdBudget ?? ""}`} slug={slug} state={state} canEdit={canEdit} canRaise={can(role, "manage_policies")} />
      <BusinessForm key={`${state.business?.id ?? ""}-${state.business?.website ?? ""}`} slug={slug} state={state} canEdit={canEdit} />
      <ResearchCard slug={slug} state={state} canEdit={canEdit} />
    </div>
  );
}

function GoalForm({ slug, state, canEdit, canRaise }: { slug: string; state: State; canEdit: boolean; canRaise: boolean }) {
  const setGoal = useMutation(api.orgs.setGoal);
  const name = state.business?.name ?? "your business";
  const defaults = goalDefaults(name);
  const [kind, setKind] = useState<GoalKind>(state.goal?.kind ?? "more_customers");
  const [statement, setStatement] = useState(state.goal?.statement ?? defaults.more_customers);
  const [horizon, setHorizon] = useState(String(state.goal?.horizonDays ?? 90));
  const [budget, setBudget] = useState(String(state.goal?.monthlyAdBudget ?? 0));
  const [reviewDay, setReviewDay] = useState(state.goal?.reviewDay ?? "Friday");
  const t = state.goal?.target;
  const [metric, setMetric] = useState<"customers" | "revenue_month" | "other">(t?.metric ?? "customers");
  const [mode, setMode] = useState<"total" | "incremental">(t?.mode ?? "total");
  const [baseline, setBaseline] = useState(t?.baseline != null ? String(t.baseline) : "");
  const [desired, setDesired] = useState(t?.desired != null ? String(t.desired) : "");
  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
  const [busy, setBusy] = useState(false);
  const currency = state.business?.currency ?? state.org.currency;
  const over = !canRaise && Number(budget || 0) > state.adCap;
  return (
    <Card id="goal">
      <CardHeader>
        <CardTitle>Your goal</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <Field label="Kind of goal">
          <Select
            value={kind}
            disabled={!canEdit}
            onValueChange={(v) => {
              setKind(v as GoalKind);
              if (!statement || Object.values(defaults).includes(statement)) setStatement(defaults[v as GoalKind]);
            }}
            options={GOAL_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.title }))}
          />
        </Field>
        <Field label="Time frame">
          <Select value={horizon} disabled={!canEdit} onValueChange={setHorizon} options={HORIZON_OPTIONS} />
        </Field>
        <Field label="Goal" className="sm:col-span-2">
          <Textarea value={statement} disabled={!canEdit} onChange={(e) => setStatement(e.target.value)} rows={2} autosize placeholder={defaults[kind]} />
        </Field>
        <Field label="Measure" hint="Plays forecast customers; revenue uses your price.">
          <Select value={metric} disabled={!canEdit} onValueChange={(v) => setMetric(v as typeof metric)} options={[{ value: "customers", label: "Customers" }, { value: "revenue_month", label: `Monthly revenue (${currency})` }, { value: "other", label: "Something else" }]} />
        </Field>
        <Field label="Goal counts as">
          <Select value={mode} disabled={!canEdit} onValueChange={(v) => setMode(v as typeof mode)} options={[{ value: "total", label: "A total to reach" }, { value: "incremental", label: "More on top of today" }]} />
        </Field>
        {mode === "total" ? (
          <Field label="Today" hint="Leave blank if unsure.">
            <Input inputMode="decimal" disabled={!canEdit} value={baseline} onChange={(e) => setBaseline(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 20" />
          </Field>
        ) : null}
        <Field label={mode === "total" ? "Goal" : "How many more"} hint="ClimbOS keeps this as you set it and shows the gap.">
          <Input inputMode="decimal" disabled={!canEdit} value={desired} onChange={(e) => setDesired(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 50" />
        </Field>
        <Field
          label={`Monthly ad budget (${currency})`}
          hint={canRaise ? "Paid to Google/Meta, not us. 0 = no ads." : `Up to ${majorToDisplay(state.adCap, currency)}. Raising needs ${PERMISSION_WHO.manage_team}.`}
          error={over ? `Only ${PERMISSION_WHO.manage_team} can raise it above ${majorToDisplay(state.adCap, currency)}.` : undefined}
        >
          <Input inputMode="decimal" disabled={!canEdit} value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Field label="Review day">
          <Select value={reviewDay} disabled={!canEdit} onValueChange={setReviewDay} options={REVIEW_DAY_OPTIONS} />
        </Field>
        {canEdit ? (
          <div className="sm:col-span-2">
            <Button
              loading={busy}
              disabled={over}
              onClick={async () => {
                setBusy(true);
                try {
                  await setGoal({ slug, kind, statement: statement.trim() || defaults[kind] || "Grow the business", target: { metric, mode, baseline: mode === "total" ? numOrNull(baseline) : null, desired: numOrNull(desired) }, horizonDays: Number(horizon), monthlyAdBudget: Number(budget || 0), reviewDay });
                  toast({ tone: "success", title: "Goal saved.", description: state.strategy ? "Refresh your plan to use it." : undefined });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save goal
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BusinessForm({ slug, state, canEdit }: { slug: string; state: State; canEdit: boolean }) {
  const save = useMutation(api.orgs.saveBusinessDetails);
  const [website, setWebsite] = useState(state.business?.website ?? "");
  const [businessType, setBusinessType] = useState<BusinessType>((state.business?.businessType as BusinessType) ?? "other");
  const [currency, setCurrency] = useState(state.business?.currency ?? state.org.currency);
  const [events, setEvents] = useState(state.business?.successEvents ?? []);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your business</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <Field label="Website" className="sm:col-span-2" hint="Then refresh research below.">
          <Input value={website} disabled={!canEdit} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbusiness.com" inputMode="url" autoComplete="url" />
        </Field>
        <Field label="Type of business">
          <Select value={businessType} disabled={!canEdit} onValueChange={(v) => setBusinessType(v as BusinessType)} options={BUSINESS_TYPE_OPTIONS} />
        </Field>
        <Field label="Currency">
          <Select value={currency} disabled={!canEdit} onValueChange={setCurrency} options={CURRENCY_OPTIONS} />
        </Field>
        <div className="sm:col-span-2">
          <p className="text-ui font-medium text-ink">What counts as success?</p>
          <ul className="mt-3 space-y-2">
            {events.map((ev, i) => (
              <li key={ev.key} className="rounded-xl border border-line px-3">
                <Checkbox
                  id={`biz-ev-${ev.key}`}
                  checked={ev.confirmed}
                  disabled={!canEdit}
                  onCheckedChange={(c) => setEvents(events.map((x, j) => (j === i ? { ...x, confirmed: c === true } : x)))}
                  label={ev.label}
                  description={ev.definition}
                />
              </li>
            ))}
            {events.length === 0 && canEdit ? (
              <li>
                <Button size="sm" variant="secondary" onClick={() => setEvents(defaultEvents(businessType))}>
                  Use common ones
                </Button>
              </li>
            ) : null}
          </ul>
        </div>
        {canEdit ? (
          <div className="sm:col-span-2">
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await save({ slug, website, businessType, currency, successEvents: events });
                  toast({ tone: "success", title: "Business details saved." });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save details
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const RESEARCH_LABEL: Record<string, { label: string; tone: "green" | "amber" | "red" | "neutral" | "blue" }> = {
  done: { label: "Up to date", tone: "green" },
  partial: { label: "Partly read", tone: "amber" },
  failed: { label: "Couldn't read the site", tone: "red" },
  running: { label: "Researching", tone: "blue" },
  owner_supplied: { label: "From your description", tone: "neutral" },
  not_started: { label: "Not started", tone: "neutral" },
};

function ResearchCard({ slug, state, canEdit }: { slug: string; state: State; canEdit: boolean }) {
  const startResearch = useMutation(api.orgs.startResearch);
  const ai = useAiMode(slug);
  const research = state.research;
  const active = research && !RUN_FINISHED.has(research.status);
  const status = RESEARCH_LABEL[state.business?.researchStatus ?? "not_started"] ?? RESEARCH_LABEL.not_started;
  const max = ai.data?.estimates.onboarding_research[ai.mode];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Research <Badge tone={status.tone}>{status.label}</Badge>
        </CardTitle>
        <CardDescription>
          {state.business?.insightsAt ? `Last done ${relativeTime(state.business.insightsAt)} · ` : ""}New facts go to{" "}
          <Link href={`/app/${slug}/settings/facts`} className="underline underline-offset-2">
            Business facts
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {active && research ? (
          <RunProgress slug={slug} runId={research.id} headingLevel="h3" />
        ) : research && ["failed", "canceled", "uncertain"].includes(research.status) ? (
          <Callout tone="warning" live="none" title="Last research didn't finish">
            {research.userMessage ?? "Nothing was changed."}
            <RetryRunIfPossible slug={slug} runId={research.id} className="mt-3" />
          </Callout>
        ) : null}
        {!active && canEdit ? (
          <div className="flex flex-col gap-1.5">
            <ConfirmDialog
              trigger={
                <Button variant="secondary" className="self-start" disabled={!state.canRunAi || !state.business?.website}>
                  <RefreshCw aria-hidden /> Refresh research
                </Button>
              }
              title="Refresh research?"
              description={`Re-reads ${state.business?.website ?? "your website"}.${max ? ` Up to ${microsToCreditsLabel(max)}; unused credits returned.` : ""}`}
              confirmLabel="Refresh research"
              onConfirm={async () => {
                try {
                  await startResearch({ slug, aiMode: ai.mode });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                }
              }}
            >
              <AiModePicker slug={slug} kind="onboarding_research" value={ai.mode} onChange={ai.setMode} />
            </ConfirmDialog>
            {!state.business?.website ? <span className="text-xs text-ink-3">Add a website first.</span> : max ? <span className="text-xs text-ink-3">Up to {microsToCreditsLabel(max)}</span> : null}
            {!state.canRunAi && state.accessMessage ? <span className="text-xs text-ink-3">{state.accessMessage}</span> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
