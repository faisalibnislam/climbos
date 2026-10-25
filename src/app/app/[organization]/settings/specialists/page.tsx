"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Bot, Check, Play, Plus } from "@/components/icons";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AGENT_ACTIONS } from "@shared/agents/registry";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, EmptyState, Field, Input, Meter, Select, Segmented, Textarea, toast } from "@/components/ui";
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
                  <p className="text-xs text-ink-3">These are team opinions about usefulness, not measured business results or time saved.</p>
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
                          {run.rating ? <p className="text-xs text-ink-2">Your rating: {run.rating === "helpful" ? "Helpful" : "Needs work"}{run.feedbackNote ? ` · ${run.feedbackNote}` : ""}</p> : null}
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
