"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { RefreshCw } from "lucide-react";
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
        intro="What your team plans around. Change it any time, then refresh your plan to use it."
        actions={
          <Link href={`/app/${slug}/plan`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Open your plan
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
  const [busy, setBusy] = useState(false);
  const currency = state.business?.currency ?? state.org.currency;
  const over = !canRaise && Number(budget || 0) > state.adCap;
  return (
    <Card id="goal">
      <CardHeader>
        <CardTitle>Your goal</CardTitle>
        <CardDescription>One clear goal keeps the plan focused.</CardDescription>
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
        <Field label="Your goal in a sentence" className="sm:col-span-2">
          <Textarea value={statement} disabled={!canEdit} onChange={(e) => setStatement(e.target.value)} rows={2} autosize placeholder={defaults[kind]} />
        </Field>
        <Field
          label={`Monthly ad budget (${currency})`}
          hint={canRaise ? "Paid directly to Google or Meta, never to ClimbOS. 0 means no ads." : `Up to ${majorToDisplay(state.adCap, currency)}. Raising it needs ${PERMISSION_WHO.manage_team}.`}
          error={over ? `Only ${PERMISSION_WHO.manage_team} can raise it above ${majorToDisplay(state.adCap, currency)}.` : undefined}
        >
          <Input inputMode="decimal" disabled={!canEdit} value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Field label="Review day" hint="We have drafts ready before then.">
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
                  await setGoal({ slug, kind, statement: statement.trim() || defaults[kind] || "Grow the business", horizonDays: Number(horizon), monthlyAdBudget: Number(budget || 0), reviewDay });
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
        <CardDescription>Used for research, budgets and how success is measured.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <Field label="Website" className="sm:col-span-2" hint="Refresh research below after changing it.">
          <Input value={website} disabled={!canEdit} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbusiness.com" inputMode="url" autoComplete="url" />
        </Field>
        <Field label="Type of business">
          <Select value={businessType} disabled={!canEdit} onValueChange={(v) => setBusinessType(v as BusinessType)} options={BUSINESS_TYPE_OPTIONS} />
        </Field>
        <Field label="Currency" hint="Used for budgets and results.">
          <Select value={currency} disabled={!canEdit} onValueChange={setCurrency} options={CURRENCY_OPTIONS} />
        </Field>
        <div className="sm:col-span-2">
          <p className="text-ui font-medium text-ink">What counts as a valuable customer action?</p>
          <p className="mt-0.5 text-xs text-ink-3">Success is measured with the ticked ones.</p>
          <ul className="mt-3 space-y-2">
            {events.map((ev, i) => (
              <li key={ev.key} className="rounded-xl border border-line px-3">
                <Checkbox
                  id={`biz-ev-${ev.key}`}
                  checked={ev.confirmed}
                  disabled={!canEdit}
                  onCheckedChange={(c) => setEvents(events.map((x, j) => (j === i ? { ...x, confirmed: c === true } : x)))}
                  label={
                    <>
                      {ev.label} — <span className="font-normal text-ink-2">{ev.definition}</span>
                    </>
                  }
                />
              </li>
            ))}
            {events.length === 0 && canEdit ? (
              <li>
                <Button size="sm" variant="secondary" onClick={() => setEvents(defaultEvents(businessType))}>
                  Use common ones for this type of business
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
          Your team re-reads your website and studies customers and competitors.
          {state.business?.insightsAt ? ` Last done ${relativeTime(state.business.insightsAt)}.` : ""} New facts wait for your check in{" "}
          <Link href={`/app/${slug}/settings/facts`} className="underline underline-offset-2">
            Business facts
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {active && research ? (
          <RunProgress slug={slug} runId={research.id} headingLevel="h3" />
        ) : research && ["failed", "canceled", "uncertain"].includes(research.status) ? (
          <Callout tone="warning" live="none" title="The last research didn't finish">
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
              description={`Your team re-reads ${state.business?.website ?? "your website"} and updates customers and competitors. ${max ? `Uses up to ${microsToCreditsLabel(max)}; unused credits are returned.` : ""} New facts wait for your check.`}
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
            {!state.business?.website ? <span className="text-xs text-ink-3">Add your website above to refresh research.</span> : max ? <span className="text-xs text-ink-3">Up to {microsToCreditsLabel(max)}</span> : null}
            {!state.canRunAi && state.accessMessage ? <span className="text-xs text-ink-3">{state.accessMessage}</span> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
