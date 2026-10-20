"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, BackLink, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, DataTable, Field, Input, Select, Skeleton, Stat, StatGroup, toast } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { errorMessage } from "../errors";
import { minorToDisplay, relativeTime } from "../money";
import type { AdminMe } from "./AdminFrame";

const can = (me: AdminMe, power: string) => (me.powers as readonly string[]).includes(power);

/** One account: package, credits, workspaces, people, jobs and every staff action. */
export function AdminAccountDetail({ accountId, me }: { accountId: Id<"accounts">; me: AdminMe }) {
  const a = useQuery(api.admin.accountDetail, { accountId });
  if (a === undefined) return <Skeleton className="h-64 w-full" />;
  if (a === null) return <p className="text-sm text-ink-3">Account not found.</p>;
  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ops/accounts">Accounts</BackLink>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="heading-page">{a.ownerEmail ?? a.name}</h1>
        {a.package ? <Badge tone={a.package.comp ? "violet" : "green"}>{a.package.name}{a.package.comp ? " (comp)" : ""}</Badge> : <Badge>Free</Badge>}
        {a.suspended ? <Badge tone="red">Suspended</Badge> : null}
      </div>
      <StatGroup>
        <Stat label="Credits available" value={formatNumber(a.credits)} />
        <Stat label="This month" value={a.period ? `${formatNumber(a.period.monthlyUsed)} / ${formatNumber(a.period.monthlyTotal)}` : "—"} sublabel={a.period ? (a.period.source === "subscription" ? `Resets ${new Date(a.period.endsAt).toLocaleDateString()}` : "Free credits") : undefined} />
        <Stat label="Top-ups" value={formatNumber(a.topupLots.reduce((s, l) => s + l.left, 0))} sublabel={`${a.topupLots.length} lot${a.topupLots.length === 1 ? "" : "s"}`} />
        <Stat label="Workspaces" value={formatNumber(a.workspaces.length)} />
      </StatGroup>

      <div className="grid gap-4 lg:grid-cols-2">
        <CreditsCard accountId={accountId} me={me} />
        {can(me, "grant") ? <CompCard accountId={accountId} subs={a.subscriptions} /> : null}
        {can(me, "manage_accounts") ? <AccountActions accountId={accountId} suspended={a.suspended} /> : null}
      </div>

      {a.workspaces.map((w) => (
        <Card key={w.id}>
          <CardHeader>
            <CardTitle as="h2">
              {w.name} <span className="font-normal text-ink-3">/{w.slug}</span> {w.suspended ? <Badge tone="red">Suspended</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <WorkspaceActions orgId={w.id} slug={w.slug} me={me} suspended={w.suspended} cap={w.monthlyCreditCap} />
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-medium text-ink-3">People ({w.people.length})</h3>
              {w.people.length ? (
                <ul className="flex flex-wrap gap-1.5 text-sm">
                  {w.people.map((p, i) => (
                    <li key={`${p.email ?? "?"}-${i}`} className="inline-flex items-center gap-1.5 rounded-[var(--radius-badge)] bg-surface-2 px-2 py-0.5">
                      <span className="text-ink">{p.email ?? "?"}</span>
                      <span className="text-ink-3">{p.role}</span>
                      {p.status === "invited" ? <Badge tone="amber">Invited</Badge> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">—</p>
              )}
            </div>
            <DataTable
              caption={`Recent jobs in ${w.name}`}
              rows={w.runs}
              rowKey={(r) => r.id}
              emptyText="No jobs yet."
              columns={[
                { key: "title", header: "Job", rowHeader: true, cell: (r) => r.title },
                { key: "status", header: "Status", cell: (r) => <Badge tone={r.status === "verified" ? "green" : r.status === "failed" ? "red" : "neutral"}>{r.status}</Badge> },
                { key: "credits", header: "Credits", align: "right", cell: (r) => formatNumber(r.credits) },
                { key: "error", header: "Error", cell: (r) => <span className="text-xs text-ink-3">{r.error ?? r.userMessage ?? ""}</span> },
                { key: "when", header: "When", cell: (r) => relativeTime(r.createdAt) },
                { key: "retry", header: "", cell: (r) => (r.canRetry && can(me, "retry") ? <RetryButton runId={r.id} /> : null) },
              ]}
            />
          </CardContent>
        </Card>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable caption="Packages" rows={a.subscriptions} rowKey={(s) => s.id} emptyText="Never subscribed." columns={[
          { key: "plan", header: "Package", rowHeader: true, cell: (s) => `${s.plan}${s.comp ? " (comp)" : ""}` },
          { key: "status", header: "Status", cell: (s) => s.status },
          { key: "until", header: "Until", cell: (s) => new Date(s.comp?.until ?? s.currentPeriodEnd).toLocaleDateString() },
        ]} />
        <DataTable caption="Payments" rows={a.orders} rowKey={(o) => o.id} emptyText="No payments." columns={[
          { key: "when", header: "Date", rowHeader: true, cell: (o) => new Date(o.createdAt).toLocaleDateString() },
          { key: "product", header: "For", cell: (o) => o.product },
          { key: "amount", header: "Amount", align: "right", cell: (o) => minorToDisplay(o.amountMinor, o.currency) },
          { key: "status", header: "Status", cell: (o) => o.status },
        ]} />
      </div>
      <DataTable caption="Activity" rows={a.audit} rowKey={(x) => x.id} emptyText="Nothing yet." columns={[
        { key: "when", header: "When", cell: (x) => relativeTime(x.createdAt) },
        { key: "who", header: "Who", cell: (x) => x.actorType },
        { key: "what", header: "What", cell: (x) => x.summary },
      ]} />
    </div>
  );
}

function Action({ label, run, variant = "secondary" }: { label: string; run: () => Promise<unknown>; variant?: "secondary" | "primary" | "danger" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={variant}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await run();
          toast({ tone: "success", title: "Done" });
        } catch (e) {
          toast({ tone: "danger", title: errorMessage(e) });
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

function CreditsCard({ accountId, me }: { accountId: Id<"accounts">; me: AdminMe }) {
  const grant = useMutation(api.admin.grantCredits);
  const remove = useMutation(api.admin.removeCredits);
  const [credits, setCredits] = useState("100");
  const [reason, setReason] = useState("");
  const n = Number(credits) || 0;
  return (
    <Panel title="Credits">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Credits">
          <Input inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/[^0-9]/g, ""))} />
        </Field>
        <Field label="Reason">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. ticket 42, failed job" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Action label={`Add ${formatNumber(n)}`} variant="primary" run={() => grant({ accountId, credits: n, reason })} />
        {can(me, "grant") ? <Action label={`Remove ${formatNumber(n)}`} run={() => remove({ accountId, credits: n, reason })} /> : null}
      </div>
      <ul className="flex flex-col gap-0.5 text-xs text-ink-3">
        <li>Added credits last 12 months</li>
        {me.role === "support" ? <li>Support: up to 500 at a time</li> : null}
      </ul>
    </Panel>
  );
}

function CompCard({ accountId, subs }: { accountId: Id<"accounts">; subs: { id: Id<"subscriptions">; planKey: string; plan: string; status: string; comp: { until: number } | null }[] }) {
  const packages = useQuery(api.admin.packages, {});
  const comp = useMutation(api.admin.compPackage);
  const change = useMutation(api.admin.changeComp);
  const end = useMutation(api.admin.endComp);
  const activeComp = subs.find((s) => s.comp && s.status === "active");
  const [plan, setPlan] = useState<"starter" | "pro">(activeComp?.planKey === "starter" ? "starter" : "pro");
  const [months, setMonths] = useState("12");
  const [reason, setReason] = useState("");
  const options = (packages ?? []).map((p) => ({ value: p.key, label: `${p.name} · ${formatNumber(p.credits)}/mo` }));
  const fields = (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Package">
        <Select value={plan} onValueChange={(v) => setPlan(v as "starter" | "pro")} options={options} />
      </Field>
      <Field label="Months">
        <Input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^0-9]/g, ""))} />
      </Field>
      <Field label="Reason">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. partner" />
      </Field>
    </div>
  );
  return (
    <Panel title="Package (free / manual)">
      {activeComp ? (
        <>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium text-ink">{activeComp.plan}</span> free until {new Date(activeComp.comp!.until).toLocaleDateString()}
            </span>
            <Action label="End comp" variant="danger" run={() => end({ subscriptionId: activeComp.id })} />
          </div>
          {fields}
          <div className="flex flex-col gap-1">
            <Action label="Change package" variant="primary" run={() => change({ subscriptionId: activeComp.id, planKey: plan, months: Number(months) || 1, reason })} />
            <p className="text-xs text-ink-3">Months count from today. An upgrade adds the new package&apos;s credits this month; a downgrade applies from the next renewal.</p>
          </div>
        </>
      ) : (
        <>
          {fields}
          <Action label="Give package" variant="primary" run={() => comp({ accountId, planKey: plan, months: Number(months) || 1, reason })} />
        </>
      )}
    </Panel>
  );
}

function AccountActions({ accountId, suspended }: { accountId: Id<"accounts">; suspended: boolean }) {
  const suspend = useMutation(api.admin.suspendAccount);
  const transfer = useMutation(api.admin.transferAccount);
  const [email, setEmail] = useState("");
  return (
    <Panel title="Account">
      <div className="flex flex-wrap gap-2">
        <Action label={suspended ? "Lift suspension" : "Suspend account"} variant={suspended ? "secondary" : "danger"} run={() => suspend({ accountId, suspend: !suspended })} />
      </div>
      <Field label="Transfer ownership to" hint="They need a ClimbOS login. The current owner becomes an admin.">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="new-owner@company.com" />
      </Field>
      <div>
        <Action label="Transfer" run={() => transfer({ accountId, newOwnerEmail: email })} />
      </div>
    </Panel>
  );
}

function WorkspaceActions({ orgId, slug, me, suspended, cap }: { orgId: Id<"organizations">; slug: string; me: AdminMe; suspended: boolean; cap: number | null }) {
  const router = useRouter();
  const view = useMutation(api.admin.startViewAs);
  const suspend = useMutation(api.admin.suspendWorkspace);
  const setCap = useMutation(api.admin.setWorkspaceCap);
  const del = useMutation(api.admin.deleteWorkspace);
  const [capText, setCapText] = useState(cap === null ? "" : String(cap));
  return (
    <div className="flex flex-wrap items-end gap-2">
      {can(me, "view_as") ? (
        <Action
          label="View as user (read-only)"
          run={async () => {
            const res = await view({ orgId, reason: "support" });
            router.push(`/app/${res.slug}/today`);
          }}
        />
      ) : null}
      {can(me, "manage_accounts") ? (
        <>
          <Action label={suspended ? "Lift suspension" : "Suspend workspace"} run={() => suspend({ orgId, suspend: !suspended })} />
          <Field label="Monthly credit cap" className="w-40">
            <Input inputMode="numeric" value={capText} onChange={(e) => setCapText(e.target.value.replace(/[^0-9]/g, ""))} placeholder="No cap" />
          </Field>
          <Action label="Save cap" run={() => setCap({ orgId, credits: capText === "" ? null : Number(capText) })} />
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="danger">
                Delete workspace
              </Button>
            }
            tone="danger"
            title="Delete this workspace?"
            description={`It disappears for everyone on it. This is logged.`}
            confirmLabel="Delete"
            onConfirm={async () => {
              try {
                await del({ orgId, confirmSlug: slug });
                toast({ tone: "success", title: "Workspace deleted" });
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function RetryButton({ runId }: { runId: Id<"workflowRuns"> }) {
  const retry = useMutation(api.admin.retryRun);
  return <Action label="Retry" run={() => retry({ runId })} />;
}
