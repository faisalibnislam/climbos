"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Bot, Check, Play, Plus } from "@/components/icons";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AGENT_ACTIONS } from "@shared/agents/registry";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, DatePicker, EmptyState, Field, Input, Meter, Select, Segmented, Textarea, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, QueryBoundary } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";

const ACTION_LABEL: Record<(typeof AGENT_ACTIONS)[number], string> = {
  generate_content: "Prepare content drafts", refresh_plan: "Review the growth plan", research: "Research the website and market",
  analyze_results: "Analyze measured results", schedule_content: "Prepare scheduling for approval", ad_change: "Prepare ad changes for approval",
  email_send: "Prepare email for approval", connect_account: "Request an account connection", set_up_autopilot: "Prepare autopilot settings",
  find_customers: "Research potential customers", note: "Write advice only",
};

type Permission = "read_only" | "draft" | "request_approval";
const creditsText = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
const runStatusText = (status: string) => status === "verified" ? "Complete" : status === "needs_approval" ? "Waiting for review" : status.replaceAll("_", " ");

const PERMISSION_OPTIONS = [
  { value: "read_only" as const, label: "Read only" },
  { value: "draft" as const, label: "Prepare drafts" },
  { value: "request_approval" as const, label: "Request approval" },
];

export default function SpecialistsSettingsPage() {
  return <QueryBoundary><SpecialistsSettings /></QueryBoundary>;
}

function SpecialistsSettings() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.customAgents.list, { slug });
  const create = useMutation(api.customAgents.create);
  const update = useMutation(api.customAgents.update);
  const archive = useMutation(api.customAgents.archive);
  const run = useMutation(api.workspace.runCustomAgent);
  const [archetypeId, setArchetypeId] = useState("chief_growth_strategist");
  const [editing, setEditing] = useState<Id<"customAgents"> | null>(null);
  const [name, setName] = useState("Chief Growth Strategist");
  const [objective, setObjective] = useState("Coordinate priorities around my growth goal.");
  const [instructions, setInstructions] = useState("");
  const [allowedActions, setAllowedActions] = useState<string[]>(["refresh_plan", "research", "analyze_results", "note"]);
  const [permission, setPermission] = useState<Permission>("draft");
  const [maxRunCredits, setMaxRunCredits] = useState(10);
  const [maxActionsPerRun, setMaxActionsPerRun] = useState(2);
  const [successMetric, setSuccessMetric] = useState("Every recommendation names its evidence, next step, and measure.");
  const [request, setRequest] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (data === undefined) return <LoadingBlock label="Loading specialist profiles" lines={4} />;

  function resetForm() {
    setEditing(null);
    const defaultAgent = data?.archetypes.find((row) => row.id === "chief_growth_strategist");
    setArchetypeId(defaultAgent?.id ?? "chief_growth_strategist");
    setName(defaultAgent?.name ?? "Chief Growth Strategist");
    setObjective(defaultAgent?.objective ?? "Coordinate priorities around my growth goal.");
    setInstructions("");
    setAllowedActions(["refresh_plan", "research", "analyze_results", "note"]);
    setPermission("draft");
    setMaxRunCredits(10);
    setMaxActionsPerRun(2);
    setSuccessMetric("Every recommendation names its evidence, next step, and measure.");
  }

  function selectArchetype(id: string) {
    const row = data?.archetypes.find((agent) => agent.id === id);
    if (!row) return;
    setArchetypeId(row.id);
    setName(row.name);
    setObjective(row.objective);
    setAllowedActions([...row.defaultActions]);
  }

  const editableActions = permission === "read_only"
    ? AGENT_ACTIONS.filter((action) => ["research", "analyze_results", "note"].includes(action))
    : permission === "draft"
      ? AGENT_ACTIONS.filter((action) => !["ad_change", "email_send", "schedule_content"].includes(action))
      : [...AGENT_ACTIONS];

  async function save() {
    setBusy(true);
    try {
      const fields = { slug, archetypeId, name, objective, instructions, allowedActions, knowledge: ["growth_library" as const], permission, maxRunCredits, maxActionsPerRun, successMetric };
      if (editing) await update({ ...fields, agentId: editing });
      else await create(fields);
      toast({ tone: "success", title: editing ? "Specialist updated" : "Specialist created" });
      resetForm();
    } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader title="Specialists" intro="Build a small, focused team from ClimbOS capabilities." />
      <Callout tone="info" title="Profiles use the existing ClimbOS engine">
        Specialist roles share metered model routes, business facts, and the approval workflow. Runs start only when you ask. External publishing, messages, and spend still need your approval.
      </Callout>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{editing ? "Edit specialist" : "Create a specialist"}</CardTitle>
          <CardDescription>Choose a role, define its objective, and limit the actions it can request.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Specialist role">
            <Select value={archetypeId} onValueChange={selectArchetype} options={data.archetypes.map((agent) => ({ value: agent.id, label: agent.name }))} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} /></Field>
            <Field label="Objective"><Input value={objective} onChange={(event) => setObjective(event.target.value)} maxLength={500} /></Field>
          </div>
          <Field label="Instructions" hint="Optional rules for this profile. ClimbOS safety and approval rules always take priority.">
            <Textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1500} rows={4} placeholder="For example: prioritize low-cost tests and label uncertain conclusions." />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-ui font-medium text-ink">Available capabilities</legend>
            <div className="grid gap-1 md:grid-cols-2">
              {editableActions.map((action) => (
                <Checkbox key={action} label={ACTION_LABEL[action]} checked={allowedActions.includes(action)} onCheckedChange={(checked) => setAllowedActions((current) => checked ? [...new Set([...current, action])] : current.filter((item) => item !== action))} />
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Permission level" hint="Drafts stay in ClimbOS. Anything external waits for your approval.">
              <Segmented label="Permission level" value={permission} onChange={(value) => { setPermission(value); if (value === "read_only") setAllowedActions((items) => items.filter((item) => ["research", "analyze_results", "note"].includes(item))); if (value === "draft") setAllowedActions((items) => items.filter((item) => !["ad_change", "email_send", "schedule_content"].includes(item))); }} options={PERMISSION_OPTIONS} />
            </Field>
            <Field label="AI model routing" hint="ClimbOS selects from its configured and metered routes."><Input value="Automatic" disabled /></Field>
            <Field label="Maximum run budget" hint="Covers the chat request and action estimates for one run.">
              <Segmented label="Maximum run budget" value={maxRunCredits} onChange={setMaxRunCredits} options={[{ value: 5, label: "5 credits" }, { value: 10, label: "10 credits" }, { value: 25, label: "25 credits" }, { value: 50, label: "50 credits" }]} />
            </Field>
            <Field label="Maximum actions per request"><Segmented label="Maximum actions per request" value={maxActionsPerRun} onChange={setMaxActionsPerRun} options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }]} /></Field>
          </div>
          <Field label="Success measure"><Input value={successMetric} onChange={(event) => setSuccessMetric(event.target.value)} maxLength={300} /></Field>
          <p className="text-xs text-ink-3">Knowledge: verified business facts and the versioned Growth Intelligence library. Trigger: manual request only.</p>
          <div className="flex flex-wrap gap-2">
            <Button loading={busy} disabled={!allowedActions.length || !objective.trim() || !successMetric.trim()} onClick={() => void save()}>{editing ? <Check aria-hidden /> : <Plus aria-hidden />}{editing ? "Save specialist" : "Create specialist"}</Button>
            {editing ? <Button variant="secondary" onClick={resetForm}>Cancel</Button> : null}
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="specialist-list-heading">
        <h2 id="specialist-list-heading" className="heading-section">Your specialists</h2>
        {!data.agents.length ? <EmptyState icon={<Bot />} title="No custom specialists yet" body="Create a profile above, then ask it to prepare focused work." /> : data.agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><CardTitle as="h3">{agent.name}</CardTitle><CardDescription>{agent.objective}</CardDescription></div>
                <Badge tone={agent.status === "active" ? "green" : "neutral"}>{agent.status === "active" ? "Active" : "Archived"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-ink-3">{agent.permission.replaceAll("_", " ")} · up to {agent.maxActionsPerRun} actions · {agent.maxRunCredits} credits per run · {agent.trigger === "manual" ? "Runs when you ask" : `Runs ${agent.trigger}`}</p>
              <section aria-label={`${agent.name} cost and usefulness`} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3">
                <h4 className="text-ui font-semibold text-ink">Cost and usefulness</h4>
                {agent.monthlyCreditsUsed === null ? (
                  <p className="text-sm text-ink-2">Monthly usage is unavailable from the records shown; no total is estimated.</p>
                ) : agent.monthlyBudgetCredits !== null ? (
                  <Meter
                    label="ClimbOS credits used or set aside this month"
                    used={agent.monthlyCreditsUsed}
                    max={agent.monthlyBudgetCredits}
                    unit="credits"
                    fullText="Monthly limit reached. This specialist will wait until the budget resets or an owner changes its limit."
                    footnote="Work that is still running or waiting for review may include estimates. Credits are not customer sales or business profit."
                  />
                ) : (
                  <p className="text-sm text-ink-2">{creditsText(agent.monthlyCreditsUsed)} ClimbOS credits used or set aside this month. No monthly credit limit is recorded for this specialist; in-progress work may include estimates.</p>
                )}
                <div className="flex flex-col gap-1.5">
                  <h5 className="text-ui font-medium text-ink-2">Team feedback · last 90 days</h5>
                  {agent.workspaceReportedFeedback.sampleSize ? (
                    <p className="text-sm text-ink-2">
                      {agent.workspaceReportedFeedback.helpful} helpful and {agent.workspaceReportedFeedback.needsWork} needing work, from {agent.workspaceReportedFeedback.sampleSize} team rating{agent.workspaceReportedFeedback.sampleSize === 1 ? "" : "s"}.
                      {agent.workspaceReportedFeedback.capped ? " Showing up to 100 recent ratings." : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-ink-3">No team ratings recorded in the last 90 days.</p>
                  )}
                  {agent.workspaceReportedFeedback.timeSavedRunCount ? (
                    <p className="text-sm text-ink-2">Median team-reported time saved: {creditsText(agent.workspaceReportedFeedback.medianMinutesSavedPerRun ?? 0)} minutes per run across {agent.workspaceReportedFeedback.timeSavedRunCount} runs. Reports from the same run are averaged first.</p>
                  ) : (
                    <p className="text-sm text-ink-3">No time-saved reports yet. Leaving time unknown is fine.</p>
                  )}
                  {agent.workspaceReportedFeedback.outcomeCount ? (
                    <div className="text-sm text-ink-2">
                      <p>{agent.workspaceReportedFeedback.outcomeCount} member-reported business result{agent.workspaceReportedFeedback.outcomeCount === 1 ? "" : "s"} in the recent feedback sample.</p>
                      <ul className="mt-1 list-disc pl-5">{agent.workspaceReportedFeedback.recentOutcomes.map((outcome, index) => <li key={`${outcome.metric}-${outcome.periodEnd}-${index}`}>{outcome.metric}: {outcome.value}{outcome.unit ? ` ${outcome.unit}` : ""}{outcome.measureType === "rate" && outcome.denominator ? ` (${outcome.denominator} measured)` : ""} · {outcome.cohort} · {new Date(outcome.periodStart).toISOString().slice(0, 10)} to {new Date(outcome.periodEnd).toISOString().slice(0, 10)}</li>)}</ul>
                    </div>
                  ) : <p className="text-sm text-ink-3">No business results have been recorded for this specialist yet.</p>}
                  <p className="text-xs text-ink-3">Time saved and usefulness are member reports, not measured business results or proof that a run caused an outcome.</p>
                  <p className="text-xs text-ink-3">Reported business results are observations for their stated cohort and dates; they are not independently verified and do not show that this specialist caused them.</p>
                  <p className="text-xs text-ink-3">ClimbOS credits measure product usage. This screen does not convert reported time into cash value or calculate return on investment.</p>
                </div>
                {agent.recentRuns.length ? (
                  <div className="flex flex-col gap-2 border-t border-line pt-3">
                    <h5 className="text-ui font-medium text-ink-2">Recent runs</h5>
                    <ul className="flex flex-col gap-2">
                      {agent.recentRuns.slice(0, 3).map((run) => (
                        <li key={run.id} className="flex flex-col gap-1 rounded-md border border-line bg-surface p-2.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="text-sm font-medium text-ink">{run.title}</span>
                            <Badge tone={run.status === "verified" ? "green" : run.status === "failed" ? "red" : "neutral"}>{runStatusText(run.status)}</Badge>
                          </div>
                          <p className="text-xs text-ink-3">
                            {new Date(run.createdAt).toLocaleDateString()} · {run.status === "verified" || run.status === "failed" || run.status === "canceled" ? `${creditsText(run.actualCredits)} credits recorded` : `${creditsText(run.actualCredits)} recorded so far; ${creditsText(run.estimateCredits)} estimated for this run`}
                          </p>
                          {run.rating ? <p className="text-xs text-ink-2">Your rating: {run.rating === "helpful" ? "Helpful" : "Needs work"}{run.minutesSaved !== null ? ` · You reported ${run.minutesSaved} minutes saved` : " · Time saved unknown"}{run.feedbackNote ? ` · ${run.feedbackNote}` : ""}</p> : null}
                          {data.canManage && ["verified", "failed", "uncertain", "canceled"].includes(run.status) ? (
                            <SpecialistRunFeedback slug={slug} runId={run.id as Id<"workflowRuns">} rating={run.rating} minutesSaved={run.minutesSaved} outcome={run.outcome} successMetric={agent.successMetric} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
              <Field label={`Ask ${agent.name}`}><Textarea rows={2} value={request[agent.id] ?? ""} onChange={(event) => setRequest((current) => ({ ...current, [agent.id]: event.target.value }))} maxLength={1500} placeholder="What should this specialist help with?" disabled={agent.status !== "active"} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={agent.status !== "active" || !(request[agent.id] ?? "").trim()} onClick={async () => { try { await run({ slug, agentId: agent.id as Id<"customAgents">, request: request[agent.id] }); setRequest((current) => ({ ...current, [agent.id]: "" })); toast({ tone: "success", title: "Specialist started", description: "Follow its progress in Today and review any proposed actions." }); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } }}><Play aria-hidden /> Run specialist</Button>
                {data.canManage && agent.status === "active" ? <Button size="sm" variant="secondary" onClick={() => { setEditing(agent.id as Id<"customAgents">); setArchetypeId(agent.archetypeId); setName(agent.name); setObjective(agent.objective); setInstructions(agent.instructions); setAllowedActions([...agent.allowedActions]); setPermission(agent.permission as Permission); setMaxRunCredits(agent.maxRunCredits); setMaxActionsPerRun(agent.maxActionsPerRun); setSuccessMetric(agent.successMetric); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button> : null}
                {data.canManage ? <Button size="sm" variant="ghost" onClick={() => void archive({ slug, agentId: agent.id as Id<"customAgents"> }).catch((error) => toast({ tone: "danger", title: errorMessage(error) }))}>{agent.status === "active" ? "Archive" : "Restore"}</Button> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function SpecialistRunFeedback({
  slug,
  runId,
  rating: initialRating,
  minutesSaved: initialMinutesSaved,
  outcome: initialOutcome,
  successMetric,
}: {
  slug: string;
  runId: Id<"workflowRuns">;
  rating: "helpful" | "needs_work" | null;
  minutesSaved: number | null;
  outcome: { metric: string; measureType: "count" | "rate" | "currency" | "duration"; value: number; unit: string; denominator?: number; comparisonValue?: number; comparisonLabel?: string; cohort: string; periodStart: number; periodEnd: number } | null;
  successMetric: string;
}) {
  const saveFeedback = useMutation(api.workspace.rateCustomAgentRun);
  const [rating, setRating] = useState<"helpful" | "needs_work" | null>(initialRating);
  const [minutesSaved, setMinutesSaved] = useState(initialMinutesSaved === null ? "" : String(initialMinutesSaved));
  const [metric, setMetric] = useState(initialOutcome?.metric ?? "");
  const [measureType, setMeasureType] = useState<"count" | "rate" | "currency" | "duration">(initialOutcome?.measureType ?? "count");
  const [value, setValue] = useState(initialOutcome ? String(initialOutcome.value) : "");
  const [unit, setUnit] = useState(initialOutcome?.unit ?? "");
  const [denominator, setDenominator] = useState(initialOutcome?.denominator === undefined ? "" : String(initialOutcome.denominator));
  const [cohort, setCohort] = useState(initialOutcome?.cohort ?? "");
  const [periodStart, setPeriodStart] = useState(initialOutcome ? new Date(initialOutcome.periodStart).toISOString().slice(0, 10) : "");
  const [periodEnd, setPeriodEnd] = useState(initialOutcome ? new Date(initialOutcome.periodEnd).toISOString().slice(0, 10) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!rating) return;
    const parsedMinutes = minutesSaved.trim() === "" ? undefined : Number(minutesSaved);
    if (parsedMinutes !== undefined && (!Number.isInteger(parsedMinutes) || parsedMinutes < 0 || parsedMinutes > 1440)) {
      toast({ tone: "danger", title: "Enter whole minutes from 0 to 1,440, or leave the answer blank." });
      return;
    }
    const hasOutcomeInput = [metric, value, unit, denominator, cohort, periodStart, periodEnd].some((item) => item.trim());
    let outcome: { metric: string; measureType: "count" | "rate" | "currency" | "duration"; value: number; unit: string; denominator?: number; cohort: string; periodStart: number; periodEnd: number } | null = null;
    if (hasOutcomeInput) {
      const numericValue = Number(value);
      const numericDenominator = denominator.trim() ? Number(denominator) : undefined;
      const startAt = periodStart ? Date.parse(`${periodStart}T00:00:00.000Z`) : NaN;
      const endAt = periodEnd ? Date.parse(`${periodEnd}T00:00:00.000Z`) : NaN;
      if (!metric.trim() || !value.trim() || !Number.isFinite(numericValue) || numericValue < 0 || !unit.trim() || !cohort.trim() || !Number.isFinite(startAt) || !Number.isFinite(endAt) || startAt > endAt) {
        toast({ tone: "danger", title: "Add the metric, result, unit, cohort, and date range—or leave the optional result blank." });
        return;
      }
      if (measureType === "rate" && (!Number.isSafeInteger(numericDenominator) || (numericDenominator ?? 0) < 1)) {
        toast({ tone: "danger", title: "For a rate, enter the number of people or items measured." });
        return;
      }
      outcome = { metric: metric.trim(), measureType, value: numericValue, unit: unit.trim(), cohort: cohort.trim(), periodStart: startAt, periodEnd: endAt, ...(numericDenominator !== undefined ? { denominator: numericDenominator } : {}) };
    }
    setBusy(true);
    try {
      await saveFeedback({ slug, runId, rating, ...(parsedMinutes !== undefined ? { minutesSaved: parsedMinutes } : {}), outcome });
      toast({ tone: "success", title: "Feedback saved", description: outcome ? "Your feedback and business result are recorded as member reports." : "Your usefulness and time estimates are recorded as member reports." });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md bg-surface-2 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-2">Was this run useful?</span>
        <Button type="button" size="sm" variant={rating === "helpful" ? "primary" : "secondary"} aria-pressed={rating === "helpful"} onClick={() => setRating("helpful")}>Helpful</Button>
        <Button type="button" size="sm" variant={rating === "needs_work" ? "primary" : "secondary"} aria-pressed={rating === "needs_work"} onClick={() => setRating("needs_work")}>Needs work</Button>
      </div>
      <Field label="Time you estimate it saved" optional hint="For this run, in minutes. Leave blank if unknown; this is your report, not a measured result.">
        <Input type="number" min={0} max={1440} step={1} value={minutesSaved} onChange={(event) => setMinutesSaved(event.target.value)} />
      </Field>
      <details className="rounded-md border border-line bg-surface p-2.5" open={Boolean(initialOutcome)}>
        <summary className="cursor-pointer text-sm font-medium text-ink-2">Record a business result (optional)</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="What did you measure?" hint={`For example: ${successMetric}`}><Input value={metric} onChange={(event) => setMetric(event.target.value)} maxLength={120} /></Field>
          <Field label="Result value"><Input type="number" min={0} step="any" value={value} onChange={(event) => setValue(event.target.value)} /></Field>
          <Field label="Value type"><Select value={measureType} onValueChange={(next) => setMeasureType(next as typeof measureType)} options={[{ value: "count", label: "Count" }, { value: "rate", label: "Rate" }, { value: "currency", label: "Money" }, { value: "duration", label: "Time" }]} /></Field>
          <Field label="Unit" hint="For example: customers, sign-ups, USD, or hours."><Input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={30} /></Field>
          {measureType === "rate" ? <Field label="Number measured"><Input type="number" min={1} step={1} value={denominator} onChange={(event) => setDenominator(event.target.value)} /></Field> : null}
          <Field label="Who or what did this cover?" hint="Name the group or period cohort, such as first-time buyers."><Input value={cohort} onChange={(event) => setCohort(event.target.value)} maxLength={160} /></Field>
          <Field label="Period start"><DatePicker value={periodStart} onChange={setPeriodStart} /></Field>
          <Field label="Period end"><DatePicker value={periodEnd} onChange={setPeriodEnd} min={periodStart || undefined} /></Field>
        </div>
        <p className="mt-2 text-xs text-ink-3">This is your report about what happened, not proof this specialist caused it. Leave the fields blank if the result is unknown.</p>
      </details>
      <div><Button size="sm" loading={busy} disabled={!rating} onClick={() => void save()}>{initialRating ? "Update feedback" : "Save feedback"}</Button></div>
    </div>
  );
}
