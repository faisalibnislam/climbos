"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { CircleAlert, CircleCheck, Download } from "@/components/icons"
import { useEffect, useState } from "react";
import { Badge, Button, DataTable, Field, Select, monthOptions } from "@/components/ui";
import { formatUsd } from "@/lib/utils";
import { LoadingBlock } from "../results/QueryBoundary";
import { OpsSection } from "./opsShared";

const pct = (n: number | null) => (n === null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(1)}%`);
const usd = (n: number) => formatUsd(n, { cents: true });

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Unit economics per plan × usage profile for a chosen rate version, with the margin gate. */
export function EconomicsSection() {
  const [version, setVersion] = useState<string | undefined>(undefined);
  const data = useQuery(api.ops.economics, version ? { rateVersionId: version } : {});

  return (
    <OpsSection id="economics" title="Economics calculator">
      {data === undefined ? (
        <LoadingBlock label="Loading economics…" lines={2} />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:w-80">
              <Field label="Rate version">
                <Select
                  value={data.rateVersion}
                  onValueChange={setVersion}
                  options={data.versions.map((v) => ({ value: v.id, label: `${v.label} (from ${v.effectiveFrom})` }))}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data.guard.ok ? (
                <Badge tone="green" icon={<CircleCheck />}>
                  Gate passing: every plan meets the margin target
                </Badge>
              ) : (
                <Badge tone="red" icon={<CircleAlert />}>
                  Gate failing: {data.guard.failures.length} plan/profile below target
                </Badge>
              )}
              <Button variant="secondary" onClick={() => downloadText(`climbos-economics-${data.rateVersion}.csv`, data.csv, "text/csv")}>
                <Download aria-hidden="true" />
                Download CSV
              </Button>
            </div>
          </div>
          <DataTable
            caption={`Monthly unit economics per plan and usage profile, rate version ${data.rateVersion} (USD)`}
            rows={data.rows}
            rowKey={(r) => `${r.plan}-${r.profile}`}
            columns={[
              { key: "plan", header: "Plan", rowHeader: true, sortValue: (r) => r.plan },
              { key: "profile", header: "Profile", sortValue: (r) => r.profile },
              { key: "price", header: "List price", align: "right", cell: (r) => usd(r.price), sortValue: (r) => r.price },
              { key: "revenue", header: "Net revenue", align: "right", cell: (r) => usd(r.revenue), sortValue: (r) => r.revenue },
              { key: "cogs", header: "COGS", align: "right", cell: (r) => usd(r.cogs), sortValue: (r) => r.cogs },
              { key: "margin", header: "Gross margin", align: "right", cell: (r) => pct(r.margin), sortValue: (r) => r.margin },
              { key: "stress", header: "Stress margin", align: "right", cell: (r) => pct(r.stressMargin), sortValue: (r) => r.stressMargin },
              { key: "floor", header: "Stress price floor", align: "right", cell: (r) => usd(r.stressFloor), sortValue: (r) => r.stressFloor },
              {
                key: "target",
                header: "Meets target",
                cell: (r) => (r.meetsTarget ? <Badge tone="green" icon={<CircleCheck />}>Yes</Badge> : <Badge tone="red" icon={<CircleAlert />}>No</Badge>),
                sortValue: (r) => (r.meetsTarget ? 1 : 0),
              },
            ]}
          />
        </>
      )}
    </OpsSection>
  );
}

/** Predicted vs actual variable cost and realized margin by plan for a month. */
export function ReconciliationSection() {
  const [month, setMonth] = useState(currentMonth);
  const valid = /^\d{4}-\d{2}$/.test(month);
  const reconcile = useAction(api.ops.reconciliation);
  const [result, setResult] = useState<{ month: string; data: FunctionReturnType<typeof api.ops.reconciliation> | null; error?: string } | null>(null);
  // Read in pages on the server (a month of usage can be far more than one query may read).
  useEffect(() => {
    if (!valid) return;
    let live = true;
    reconcile({ month }).then(
      (d) => live && setResult({ month, data: d }),
      (e: Error) => live && setResult({ month, data: null, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [month, valid, reconcile]);
  const data = result?.month === month ? result.data : undefined;

  return (
    <OpsSection id="reconciliation" title="Reconciliation">
      <div className="w-full sm:w-56">
        <Field label="Month" error={valid ? undefined : "Use the format YYYY-MM."}>
          <Select value={month} onValueChange={setMonth} options={monthOptions(24)} />
        </Field>
      </div>
      {!valid ? null : data === undefined ? (
        <LoadingBlock label="Loading reconciliation…" lines={1} />
      ) : data === null ? (
        <p className="text-ui text-ink-2">Couldn&apos;t load this month. {result?.error}</p>
      ) : (
        <>
          <p className="text-ui text-ink-2">{data.note}</p>
          <DataTable
            caption={`Realized variable margin by plan, ${data.month}`}
            rows={data.plans}
            rowKey={(r) => r.plan}
            emptyText="No orders or usage recorded this month."
            columns={[
              { key: "plan", header: "Plan", rowHeader: true },
              { key: "ws", header: "Workspaces", align: "right", cell: (r) => String(r.workspaces) },
              { key: "rev", header: "Net revenue", align: "right", cell: (r) => usd(r.netRevenueUsd) },
              { key: "cost", header: "Variable cost", align: "right", cell: (r) => usd(r.variableCostUsd) },
              { key: "margin", header: "Variable margin", align: "right", cell: (r) => pct(r.variableMargin) },
            ]}
          />
          <p className="text-ui text-ink-2">
            Unresolved reservations held: <strong className="font-semibold text-ink">{usd(data.unresolvedReservationsUsd)}</strong>
          </p>
        </>
      )}
    </OpsSection>
  );
}
