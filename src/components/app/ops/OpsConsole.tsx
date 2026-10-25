"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CircleAlert, CircleCheck, EyeOff, History } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, Callout, ConfirmDialog, DataTable, Stat, StatGroup, buttonClasses, toast } from "@/components/ui";
import { KeyValueList } from "@/components/ds/data/display";
import { formatNumber } from "@/lib/utils";
import { formatDateTime, microsToUsd, relativeTime } from "../money";
import { LoadingBlock, PageHeader } from "../results/QueryBoundary";
import { FleetControls } from "./FleetControls";
import { EconomicsSection, ReconciliationSection } from "./OpsEconomics";
import { opsError, OpsSection } from "./opsShared";
import { ResolveUncertainDialog } from "./ResolveUncertainDialog";

export type { Dashboard } from "./opsShared";

const SECTIONS = [
  ["health", "Health"],
  ["jobs", "Jobs needing attention"],
  ["webhooks", "Webhooks"],
  ["costs", "Costs & margin"],
  ["economics", "Economics calculator"],
  ["reconciliation", "Reconciliation"],
  ["controls", "Fleet controls"],
  ["audit", "Operator audit log"],
] as const;

function OkBadge({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return ok ? (
    <Badge tone="green" icon={<CircleCheck />}>
      {okText}
    </Badge>
  ) : (
    <Badge tone="red" icon={<CircleAlert />}>
      {badText}
    </Badge>
  );
}

const shortId = (id: string) => `…${id.slice(-6)}`;
const durationLabel = (milliseconds: number | null) => milliseconds == null
  ? "Need at least 5 samples"
  : milliseconds < 1_000
    ? `${milliseconds} ms`
    : `${(milliseconds / 1_000).toFixed(1)} s`;

export function OpsConsole() {
  const d = useQuery(api.ops.dashboard, {});
  const audit = useQuery(api.ops.auditLog, {});
  const resetCircuit = useMutation(api.ops.resetCircuit);
  const retryWebhook = useMutation(api.ops.retryWebhook);
  const [resolving, setResolving] = useState<{ id: string; title: string } | null>(null);

  if (d === undefined) return <LoadingBlock label="Loading console…" lines={5} />;

  const attention = d.jobs.failed.length + d.jobs.uncertain.length + d.jobs.stuck.length + d.jobs.unresolvedReservations.length;
  const subsByStatus = d.customers.subscriptions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          section="ops"
          title="Operator console"
          intro="Fleet health, money and controls."
        />
        <ul className="-mt-3 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-ui text-ink-2">
          <li className="flex items-center gap-1.5">
            <EyeOff aria-hidden className="size-4 text-ink-3" /> Customer content, contact lists and secrets never shown
          </li>
          <li className="flex items-center gap-1.5">
            <History aria-hidden className="size-4 text-ink-3" /> Every action audited
          </li>
        </ul>
        <nav aria-label="Console sections" className="-mx-1 -mt-3 flex gap-1 overflow-x-auto pb-1">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={buttonClasses({ variant: "ghost", size: "sm", className: "shrink-0 text-ink-2" })}>
              {label}
            </a>
          ))}
        </nav>
      </div>

      {d.fleet.emergencyStop ? (
        <Callout tone="danger" title="Fleet stop is ON — no customer work is running">
          {d.fleet.stopReason ?? "No reason recorded."}
        </Callout>
      ) : null}

      <OpsSection id="health" title="Health">
        <StatGroup>
          <Stat label="Fleet" value={d.fleet.emergencyStop ? "Stopped" : "Running"} sublabel={d.fleet.emergencyStop ? "Emergency stop active" : "No emergency stop"} />
          <Stat label="Open circuits" value={formatNumber(d.fleet.circuits.filter((c) => c.state !== "closed").length)} sublabel={`${d.fleet.circuits.length} tracked`} />
          <Stat label="Customer workspaces" value={formatNumber(d.customers.workspaces)} sublabel="Most recent 100 counted" />
          <Stat label="Needs attention" value={formatNumber(attention)} sublabel="Failed, uncertain, stuck, unresolved" />
        </StatGroup>
        <div className="flex flex-wrap items-center gap-2">
          <OkBadge ok={d.margin.ok} okText="Margin gate passing" badText={`Margin gate failing (${d.margin.failures.length})`} />
          <KeyValueList
            variant="inline"
            items={[
              { k: "Rates", v: d.margin.rateVersion, mono: true },
              { k: "Entitlements", v: d.margin.entitlementVersion, mono: true },
              { k: "Routing", v: d.margin.routingVersion, mono: true },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ui font-medium text-ink-2">Subscriptions</span>
          {Object.keys(subsByStatus).length === 0 ? (
            <span className="text-ui text-ink-3">none</span>
          ) : (
            <KeyValueList variant="inline" items={Object.entries(subsByStatus).map(([s, n]) => ({ k: s.replace(/_/g, " "), v: formatNumber(n) }))} />
          )}
        </div>
        <h3 className="heading-card mt-2">Circuit breakers</h3>
        <DataTable
          caption="Provider circuit breakers"
          hideCaption
          rows={d.fleet.circuits}
          rowKey={(c) => c.provider}
          emptyText="No circuits tracked — all providers closed."
          columns={[
            { key: "provider", header: "Provider", rowHeader: true },
            {
              key: "state",
              header: "State",
              cell: (c) => <Badge tone={c.state === "closed" ? "green" : c.state === "open" ? "red" : "amber"}>{c.state.replace("_", "-")}</Badge>,
            },
            { key: "failures", header: "Failures", align: "right", cell: (c) => formatNumber(c.failures) },
            { key: "opened", header: "Opened", cell: (c) => (c.openedAt ? relativeTime(c.openedAt) : "—") },
            {
              key: "action",
              header: <span className="sr-only">Action</span>,
              cell: (c) => (
                <ConfirmDialog
                  title={`Reset the ${c.provider} circuit?`}
                  description="Calls to this provider resume immediately. If it is still failing, the breaker will open again after repeated errors."
                  confirmLabel={`Reset ${c.provider}`}
                  onConfirm={async () => {
                    try {
                      await resetCircuit({ provider: c.provider });
                      toast({ tone: "success", title: `${c.provider} circuit reset` });
                    } catch (err) {
                      toast({ tone: "danger", title: "Reset failed", description: opsError(err) });
                    }
                  }}
                  trigger={
                    <Button size="sm" variant="secondary">
                      Reset
                    </Button>
                  }
                />
              ),
            },
          ]}
        />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="heading-card">Connections expiring within 7 days ({d.connections.expiring.length})</h3>
            <DataTable
              caption="Expiring connections"
              hideCaption
              rows={d.connections.expiring}
              rowKey={(c) => c.id}
              emptyText="None."
              columns={[
                { key: "provider", header: "Provider", rowHeader: true },
                { key: "org", header: "Workspace", cell: (c) => <code className="text-xs">{shortId(c.orgId)}</code> },
                { key: "exp", header: "Expires", cell: (c) => (c.expiresAt ? relativeTime(c.expiresAt) : "—") },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="heading-card">Pending privacy requests ({d.privacy.length})</h3>
            <DataTable
              caption="Pending privacy requests"
              hideCaption
              rows={d.privacy}
              rowKey={(p) => p.id}
              emptyText="None."
              columns={[
                { key: "kind", header: "Kind", rowHeader: true, cell: (p) => p.kind.replace(/_/g, " ") },
                { key: "org", header: "Workspace", cell: (p) => <code className="text-xs">{shortId(p.orgId)}</code> },
                { key: "age", header: "Requested", cell: (p) => relativeTime(p.createdAt) },
              ]}
            />
          </div>
        </div>
      </OpsSection>

      <OpsSection id="jobs" title="Jobs needing attention" count={attention}>
        <h3 className="heading-card">Uncertain outcomes ({d.jobs.uncertain.length})</h3>
        <Callout tone="warning" live="none" title="Check the provider manually before resolving">
          Never retried automatically.
        </Callout>
        <DataTable
          caption="Uncertain runs"
          hideCaption
          rows={d.jobs.uncertain}
          rowKey={(r) => r.id}
          emptyText="None."
          columns={[
            { key: "title", header: "Run", rowHeader: true },
            { key: "org", header: "Workspace", cell: (r) => <code className="text-xs">{shortId(r.orgId)}</code> },
            { key: "updated", header: "Updated", cell: (r) => relativeTime(r.updatedAt) },
            {
              key: "action",
              header: <span className="sr-only">Action</span>,
              cell: (r) => (
                <Button size="sm" variant="secondary" onClick={() => setResolving({ id: r.id, title: r.title })}>
                  Resolve…
                </Button>
              ),
            },
          ]}
        />
        <h3 className="heading-card mt-2">Failed in the last 7 days ({d.jobs.failed.length})</h3>
        <DataTable
          caption="Failed runs"
          hideCaption
          rows={d.jobs.failed}
          rowKey={(r) => r.id}
          emptyText="None."
          columns={[
            { key: "title", header: "Run", rowHeader: true },
            { key: "org", header: "Workspace", cell: (r) => <code className="text-xs">{shortId(r.orgId)}</code> },
            { key: "error", header: "Error", cell: (r) => <span>{r.error ?? "—"}</span> },
            { key: "updated", header: "When", cell: (r) => relativeTime(r.updatedAt) },
          ]}
        />
        <h3 className="heading-card mt-2">Stuck for over 10 minutes ({d.jobs.stuck.length})</h3>
        <DataTable
          caption="Stuck runs"
          hideCaption
          rows={d.jobs.stuck}
          rowKey={(r) => r.id}
          emptyText="None."
          columns={[
            { key: "title", header: "Run", rowHeader: true },
            { key: "status", header: "Status", cell: (r) => r.status.replace(/_/g, " ") },
            { key: "org", header: "Workspace", cell: (r) => <code className="text-xs">{shortId(r.orgId)}</code> },
            { key: "updated", header: "Last update", cell: (r) => relativeTime(r.updatedAt) },
          ]}
        />
        <h3 className="heading-card mt-2">Unresolved cost reservations ({d.jobs.unresolvedReservations.length})</h3>
        <DataTable
          caption="Unresolved reservations"
          hideCaption
          rows={d.jobs.unresolvedReservations}
          rowKey={(r) => r.id}
          emptyText="None."
          columns={[
            { key: "id", header: "Reservation", rowHeader: true, cell: (r) => <code className="text-xs">{shortId(r.id)}</code> },
            { key: "org", header: "Workspace", cell: (r) => <code className="text-xs">{shortId(r.orgId)}</code> },
            { key: "wallet", header: "Wallet held", align: "right", cell: (r) => microsToUsd(r.walletMicros) },
            { key: "topup", header: "Top-up held", align: "right", cell: (r) => microsToUsd(r.topupMicros) },
            { key: "age", header: "Created", cell: (r) => relativeTime(r.createdAt) },
          ]}
        />
      </OpsSection>

      <OpsSection id="webhooks" title="Webhooks" count={d.webhooks.failed.length + d.webhooks.lagging.length}>
        <h3 className="heading-card">Failed ({d.webhooks.failed.length})</h3>
        <DataTable
          caption="Failed webhooks"
          hideCaption
          rows={d.webhooks.failed}
          rowKey={(w) => w.id}
          emptyText="None."
          columns={[
            { key: "type", header: "Event", rowHeader: true, cell: (w) => `${w.source} · ${w.type}` },
            { key: "attempts", header: "Attempts", align: "right", cell: (w) => formatNumber(w.attempts) },
            { key: "error", header: "Error", cell: (w) => <span>{w.error ?? "—"}</span> },
            { key: "received", header: "Received", cell: (w) => relativeTime(w.receivedAt) },
            {
              key: "action",
              header: <span className="sr-only">Action</span>,
              cell: (w) => (
                <ConfirmDialog
                  title="Retry this webhook?"
                  description={`The ${w.source} ${w.type} event will be processed again. Processing is idempotent, so a duplicate grant can't happen.`}
                  confirmLabel="Retry webhook"
                  onConfirm={async () => {
                    try {
                      await retryWebhook({ webhookId: w.id as Id<"webhookEvents"> });
                      toast({ tone: "success", title: "Webhook queued for retry" });
                    } catch (err) {
                      toast({ tone: "danger", title: "Retry failed", description: opsError(err) });
                    }
                  }}
                  trigger={
                    <Button size="sm" variant="secondary">
                      Retry
                    </Button>
                  }
                />
              ),
            },
          ]}
        />
        <h3 className="heading-card mt-2">Waiting over 5 minutes ({d.webhooks.lagging.length})</h3>
        <DataTable
          caption="Lagging webhooks"
          hideCaption
          rows={d.webhooks.lagging}
          rowKey={(w) => w.id}
          emptyText="None."
          columns={[
            { key: "type", header: "Event", rowHeader: true, cell: (w) => `${w.source} · ${w.type}` },
            { key: "received", header: "Received", cell: (w) => `${relativeTime(w.receivedAt)} (${formatDateTime(w.receivedAt)})` },
          ]}
        />
      </OpsSection>

      <OpsSection id="costs" title="Costs & margin">
        <StatGroup>
          <Stat label="Provider spend, 24h" value={microsToUsd(d.costs.spend24hMicros)} />
          <Stat
            label="Estimate vs actual, 7d"
            value={`${microsToUsd(d.costs.actual7dMicros)}`}
            sublabel={`Estimated ${microsToUsd(d.costs.estimate7dMicros)} for verified runs`}
            change={`${formatNumber(d.costs.overEstimateRuns)} runs over estimate`}
          />
          <Stat label="Previews, 24h" value={formatNumber(d.costs.previews24h)} sublabel={`Spend ${microsToUsd(d.costs.previewSpend24hMicros)}`} />
          <Stat label="Homepage snapshot ready, P50" value={durationLabel(d.costs.previewLearning.firstValueP50Ms)} sublabel={`${formatNumber(d.costs.previewLearning.firstValueSamples)} timed previews${d.costs.previewLearningCoverageCapped ? "; sample capped" : ""}`} />
          <Stat label="Full preview complete, P50" value={durationLabel(d.costs.previewLearning.completedP50Ms)} sublabel={`${formatNumber(d.costs.previewLearning.completedSamples)} completed previews${d.costs.previewLearningCoverageCapped ? "; sample capped" : ""}`} />
          <Stat label="Snapshot marked useful" value={d.costs.previewLearning.usefulnessRate == null ? "Not enough responses" : `${Math.round(d.costs.previewLearning.usefulnessRate * 100)}%`} sublabel={`${formatNumber(d.costs.previewLearning.usefulnessResponses)} optional, user-reported responses${d.costs.previewLearningCoverageCapped ? "; sample capped" : ""}`} />
          <Stat label="Research cache hits, 24h" value={formatNumber(d.costs.researchCache24h.hits)} sublabel={d.costs.researchCache24h.coverageCapped ? "At least this many; view is capped" : "Reused tenant-scoped research results; not a dollar-savings estimate"} />
          <Stat label="Preview daily budget" value={microsToUsd(d.fleet.previewDailyBudgetMicros)} sublabel="Change in Fleet controls" />
        </StatGroup>
        <DataTable
          caption="Spend by provider, last 24 hours"
          rows={[...d.costs.byProvider].sort((a, b) => b.costMicros - a.costMicros)}
          rowKey={(p) => p.provider}
          emptyText="No usage in the last 24 hours."
          columns={[
            { key: "provider", header: "Provider", rowHeader: true },
            { key: "calls", header: "Events", align: "right", cell: (p) => formatNumber(p.calls) },
            { key: "cost", header: "Cost", align: "right", cell: (p) => microsToUsd(p.costMicros) },
          ]}
        />
        <h3 className="heading-card mt-2">Cost by task and step, last 24 hours</h3>
        <p className="text-xs text-ink-3">
          Execution tags cover {d.costs.byTaskPhase24h.taggedEvents} of {d.costs.byTaskPhase24h.events} recent usage events
          {d.costs.byTaskPhase24h.coverage === null ? "." : ` (${Math.round(d.costs.byTaskPhase24h.coverage * 100)}%).`}
          {" "}Older events are shown as untagged; task and step labels describe where cost was recorded, not output quality.
        </p>
        <DataTable
          caption="AI and service spend by task, step, role, route and model in the last 24 hours"
          rows={d.costs.byTaskPhase24h.groups.slice(0, 50)}
          rowKey={(row) => [row.taskKind, row.stepKind, row.role ?? "", row.routingVersionId, row.aiMode, row.provider, row.model ?? ""].join(":")}
          emptyText="No usage in the last 24 hours."
          columns={[
            { key: "task", header: "Task", rowHeader: true, cell: (row) => row.taskKind.replace(/_/g, " ") },
            { key: "step", header: "Step", cell: (row) => row.stepKind.replace(/_/g, " ") },
            { key: "role", header: "Role", cell: (row) => row.role ?? "—" },
            { key: "model", header: "Provider / model", cell: (row) => `${row.provider} · ${row.model ?? "unknown"}` },
            { key: "route", header: "Route", cell: (row) => `${row.routingVersionId} · ${row.aiMode}` },
            { key: "events", header: "Events", align: "right", cell: (row) => formatNumber(row.calls) },
            { key: "cost", header: "Cost", align: "right", cell: (row) => microsToUsd(row.costMicros) },
          ]}
        />
        {!d.margin.ok ? (
          <Callout tone="danger" live="none" title="Margin gate failing">
            <ul className="list-disc pl-5">
              {d.margin.failures.map((f) => (
                <li key={`${f.plan}-${f.profile}`}>
                  {f.plan} / {f.profile}: margin {(f.grossMargin * 100).toFixed(1)}%, stress {(f.stressMargin * 100).toFixed(1)}%
                </li>
              ))}
            </ul>
          </Callout>
        ) : null}
      </OpsSection>

      <EconomicsSection />
      <ReconciliationSection />
      <FleetControls fleet={d.fleet} />

      <OpsSection id="audit" title="Operator audit log">
        {audit === undefined ? (
          <LoadingBlock label="Loading audit log…" lines={1} />
        ) : (
          <DataTable
            caption="Most recent 100 operator actions"
            rows={audit}
            rowKey={(a) => a.id}
            emptyText="No operator actions yet."
            columns={[
              { key: "when", header: "When", rowHeader: true, cell: (a) => <span title={formatDateTime(a.createdAt)}>{relativeTime(a.createdAt)}</span> },
              { key: "action", header: "Action", cell: (a) => <code className="text-xs">{a.action}</code> },
              { key: "summary", header: "Summary" },
            ]}
          />
        )}
      </OpsSection>

      <ResolveUncertainDialog run={resolving} onClose={() => setResolving(null)} />
    </div>
  );
}
