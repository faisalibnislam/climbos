"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { Repeat2 } from "@/components/icons";
import { Scannable } from "@/components/ds/content";
import { Callout, Table, TableFrame, TBody, Td, Th, THead, Tr } from "@/components/ui";
import { cn, formatNumber } from "@/lib/utils";
import { formatPercent } from "./format";
import { Definition, ValueKind } from "./Provenance";
import { LoadingBlock } from "./QueryBoundary";

type Cohorts = FunctionReturnType<typeof api.analytics.cohorts>;

function monthLabel(cohort: string): string {
  return new Date(`${cohort}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Light-to-strong green so the strongest months stand out; dark text keeps contrast at every step. */
function cellTone(fraction: number): string {
  if (fraction >= 0.75) return "bg-brand-200";
  if (fraction >= 0.5) return "bg-brand-100";
  if (fraction > 0) return "bg-brand-50";
  return "bg-surface";
}

function CohortTable({ data }: { data: Cohorts }) {
  const months = data.rows[0]?.retention.length ?? 0;
  return (
    <TableFrame>
      <Table>
        <caption className="sr-only">Recorded repeat charges by first recorded charge month in UTC</caption>
        <THead>
          <tr>
            <Th>First recorded</Th>
            <Th numeric>Payer IDs</Th>
            {Array.from({ length: months }, (_, k) => (
              <Th key={k} numeric className="px-3">
                {k === 0 ? "Entry month" : `+${k} mo`}
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {data.rows.map((row) => (
            <Tr key={row.cohort}>
              <th scope="row" className="h-11 whitespace-nowrap px-4 py-2 text-left align-middle font-medium text-ink">
                {monthLabel(row.cohort)}
              </th>
              <Td numeric>{formatNumber(row.size)}</Td>
              {row.retention.map((r, k) =>
                r === null ? (
                  <Td key={k} numeric className="px-3 text-ink-3">
                    <span aria-hidden="true">·</span>
                    <span className="sr-only">Month not over yet</span>
                  </Td>
                ) : (
                  <Td key={k} numeric className={cn("px-3 text-ink", cellTone(r))}>
                    {formatPercent(r, 0)}
                    <span className="block text-xs font-normal">{formatNumber(row.activeCustomers[k] ?? 0)} of {formatNumber(row.size)}</span>
                  </Td>
                ),
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}

/** Do customers keep paying? Monthly cohorts from billing data, observed only. */
export function CohortsSection({ slug }: { slug: string }) {
  const data = useQuery(api.analytics.cohorts, { slug });
  const latestFull = data?.rows.filter((r) => r.retention[1] !== null && r.retention[1] !== undefined).at(-1);

  return (
    <section aria-labelledby="cohorts-heading" className="flex flex-col gap-4">
      <h2 id="cohorts-heading" className="heading-section flex flex-wrap items-center gap-2">
        <Repeat2 aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> Recorded repeat payments <ValueKind kind="observed" />
      </h2>
      <p className="text-xs text-ink-3">Owner-recorded sales stay in the customer pipeline; they do not establish collected payments and are excluded here.</p>
      {data === undefined ? (
        <LoadingBlock label="Loading returning-customer information…" lines={3} />
      ) : data.issue ? (
        <Callout tone="info" title="Repeat-payment figures unavailable">
          {data.issue} <Link href={`/app/${slug}/connections`}>Review billing connection</Link>
        </Callout>
      ) : data.rows.length === 0 ? (
        <Callout tone="info" title={data.hasCustomerIds ? "No recorded entry cohorts in your available history" : "No customer-level billing data"}>
          Cohorts need positive charges with customer IDs. Existing payers stay in their original recorded month, even when it is outside your available history. <Link href={`/app/${slug}/connections`}>Review billing connection</Link>
        </Callout>
      ) : (
        <>
          {latestFull ? (
            <p className="text-sm text-ink">
              <strong className="font-semibold">{formatPercent(latestFull.retention[1] ?? 0, 0)}</strong> of {monthLabel(latestFull.cohort)}&apos;s{" "}
              {formatNumber(latestFull.size)} payer IDs have a recorded charge the following month ({formatNumber(latestFull.activeCustomers[1] ?? 0)} of {formatNumber(latestFull.size)}).
            </p>
          ) : null}
          <p className="text-sm text-ink-2">
            Refunds do not reset entry or erase recorded charge activity. Import completeness is unknown: 0% means no recorded charge, not verified churn.
          </p>
          <CohortTable data={data} />
          <Definition>
            <Scannable
              shape="bullets"
              max={4}
              tone="muted"
              text={`First recorded positive charge before refunds, in UTC (${data.currency}); IDs are separate per billing source. A dot means the follow-up month is unfinished; entry-month counts can still grow. Annual or irregular payments are not monthly churn. Only cohorts whose entry month starts within your plan's history window are shown.`}
            />
          </Definition>
        </>
      )}
    </section>
  );
}
