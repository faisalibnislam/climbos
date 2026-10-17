"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { Callout, DataTable, Stat, StatGroup } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { microsToDisplay } from "../money";
import { LoadingBlock } from "../results/QueryBoundary";
import { roleTitle } from "../roles";
import { SettingsHeader } from "./SettingsNav";

export function UsageSettings({ slug }: { slug: string }) {
  const data = useQuery(api.settings.usage, { slug });
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Usage details"
        intro="The advanced view: which AI roles and models did the work in the last 31 days, with token counts and ClimbOS's own provider cost."
      />
      <Callout tone="info">
        Looking for how much of your plan is left? That&apos;s on <Link href={`/app/${slug}/settings/billing`}>Billing</Link>, shown as simple meters. The costs below
        are what ClimbOS pays its AI providers — they are not extra charges to you.
      </Callout>
      {data === undefined ? (
        <LoadingBlock label="Loading usage…" />
      ) : (
        <>
          <StatGroup className="lg:grid-cols-3">
            <Stat label="Provider cost (last 31 days)" value={microsToDisplay(data.totalCostMicros)} sublabel="Measured from provider responses" />
            <Stat label="Recorded events" value={formatNumber(data.events)} sublabel="Model calls, searches, images and page reads" />
            <Stat label="AI roles used" value={formatNumber(data.byRole.length)} />
          </StatGroup>
          {data.events >= 3000 ? <p className="text-sm text-ink-3">Showing the most recent 3,000 events.</p> : null}
          <section aria-labelledby="by-role" className="flex flex-col gap-3">
            <h2 id="by-role" className="heading-section">
              By AI role
            </h2>
            <DataTable
              caption="Usage by AI role, last 31 days"
              hideCaption
              rows={[...data.byRole].sort((a, b) => b.costMicros - a.costMicros)}
              rowKey={(r) => r.role}
              emptyText="No AI work recorded in the last 31 days."
              columns={[
                { key: "role", header: "Role", rowHeader: true, cell: (r) => (r.role === "system" ? "ClimbOS system" : roleTitle(r.role)), sortValue: (r) => r.role },
                { key: "calls", header: "Model calls", align: "right", cell: (r) => formatNumber(r.calls), sortValue: (r) => r.calls },
                { key: "in", header: "Input tokens", align: "right", cell: (r) => formatNumber(r.inputTokens), sortValue: (r) => r.inputTokens },
                { key: "out", header: "Output tokens", align: "right", cell: (r) => formatNumber(r.outputTokens), sortValue: (r) => r.outputTokens },
                { key: "cost", header: "Provider cost", align: "right", cell: (r) => microsToDisplay(r.costMicros), sortValue: (r) => r.costMicros },
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
              emptyText="No usage recorded in the last 31 days."
              columns={[
                { key: "model", header: "Model or service", rowHeader: true, cell: (r) => <span className="font-mono text-ui">{r.model}</span>, sortValue: (r) => r.model },
                { key: "calls", header: "Events", align: "right", cell: (r) => formatNumber(r.calls), sortValue: (r) => r.calls },
                { key: "cost", header: "Provider cost", align: "right", cell: (r) => microsToDisplay(r.costMicros), sortValue: (r) => r.costMicros },
              ]}
            />
          </section>
          <p className="text-sm text-ink-3">
            Tokens are the units AI models read and write — roughly ¾ of a word each. Input tokens are what ClimbOS sends; output tokens are what the model writes back.
          </p>
        </>
      )}
    </div>
  );
}
