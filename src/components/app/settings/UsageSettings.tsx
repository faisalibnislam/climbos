"use client";

import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Callout, DataTable, Stat, StatGroup } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { microsToCreditsLabel, microsToUsdCost } from "../money";
import { useCostDisplay } from "../useCostDisplay";
import { LoadingBlock } from "../results/QueryBoundary";
import { roleTitle } from "../roles";
import { SettingsHeader } from "./SettingsNav";

type Usage = FunctionReturnType<typeof api.settings.usage>;
type CostRow = { costMicros: number; providerMicros?: number };

/** Provider cost is in the payload only when an operator enabled it for this user. */
const apiCost = (d: Usage) => d.totalProviderMicros !== undefined;

export function UsageSettings({ slug }: { slug: string }) {
  const load = useAction(api.settings.usage);
  const fmt = useCostDisplay();
  const [data, setData] = useState<FunctionReturnType<typeof api.settings.usage> | null | undefined>(undefined);
  // Summed on the server across every event of the last 31 days (read in pages).
  useEffect(() => {
    let live = true;
    load({ slug }).then(
      (d) => live && setData(d),
      () => live && setData(null),
    );
    return () => {
      live = false;
    };
  }, [slug, load]);
  const usd = fmt.usd && data ? apiCost(data) : false;
  const costColumn = usd
    ? { key: "cost", header: "API cost", align: "right" as const, cell: (r: CostRow) => microsToUsdCost(r.providerMicros ?? 0), sortValue: (r: CostRow) => r.providerMicros ?? 0 }
    : { key: "cost", header: "Credits", align: "right" as const, cell: (r: CostRow) => microsToCreditsLabel(r.costMicros), sortValue: (r: CostRow) => r.costMicros };
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Usage details"
        intro="Last 31 days"
      />
      <Callout tone="info">
        {usd ? "What providers billed us. You pay in credits. " : "Our provider costs, not extra charges. "}Credits left: <Link href={`/app/${slug}/settings/billing`}>Billing</Link>.
      </Callout>
      {data === undefined ? (
        <LoadingBlock label="Loading usage…" />
      ) : data === null ? (
        <Callout tone="warning">Usage didn&apos;t load. Refresh.</Callout>
      ) : (
        <>
          <StatGroup className="lg:grid-cols-3">
            {usd ? <Stat label="API cost" value={microsToUsdCost(data.totalProviderMicros ?? 0)} /> : <Stat label="Credits used" value={microsToCreditsLabel(data.totalCostMicros)} />}
            <Stat label="Events" value={formatNumber(data.events)} />
            <Stat label="AI roles used" value={formatNumber(data.byRole.length)} />
          </StatGroup>
          <section aria-labelledby="by-role" className="flex flex-col gap-3">
            <h2 id="by-role" className="heading-section">
              By AI role
            </h2>
            <DataTable
              caption="Usage by AI role, last 31 days"
              hideCaption
              rows={[...data.byRole].sort((a, b) => b.costMicros - a.costMicros)}
              rowKey={(r) => r.role}
              emptyText="None yet"
              columns={[
                { key: "role", header: "Role", rowHeader: true, cell: (r) => (r.role === "system" ? "ClimbOS system" : roleTitle(r.role)), sortValue: (r) => r.role },
                { key: "calls", header: "Model calls", align: "right", cell: (r) => formatNumber(r.calls), sortValue: (r) => r.calls },
                { key: "in", header: "Input tokens", align: "right", cell: (r) => formatNumber(r.inputTokens), sortValue: (r) => r.inputTokens },
                { key: "out", header: "Output tokens", align: "right", cell: (r) => formatNumber(r.outputTokens), sortValue: (r) => r.outputTokens },
                costColumn,
              ]}
            />
          </section>
          <section aria-labelledby="by-model" className="flex flex-col gap-3">
            <h2 id="by-model" className="heading-section">
              By model or service
            </h2>
            <DataTable
              caption="Usage by model or service, last 31 days"
              hideCaption
              rows={[...data.byModel].sort((a, b) => b.costMicros - a.costMicros)}
              rowKey={(r) => r.model}
              emptyText="None yet"
              columns={[
                { key: "model", header: "Model or service", rowHeader: true, cell: (r) => <span className="font-mono text-ui">{r.model}</span>, sortValue: (r) => r.model },
                { key: "calls", header: "Events", align: "right", cell: (r) => formatNumber(r.calls), sortValue: (r) => r.calls },
                costColumn,
              ]}
            />
          </section>
          <p className="text-sm text-ink-3">1 token ≈ ¾ word</p>
        </>
      )}
    </div>
  );
}
