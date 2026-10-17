"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import Link from "next/link";
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
        <caption className="sr-only">Share of each month&apos;s new customers who paid again in later months</caption>
        <THead>
          <tr>
            <Th>First paid</Th>
            <Th numeric>Customers</Th>
            {Array.from({ length: months }, (_, k) => (
              <Th key={k} numeric className="px-3">
                {k === 0 ? "Month 1" : `+${k} mo`}
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
      <div>
        <h2 id="cohorts-heading" className="heading-section flex flex-wrap items-center gap-2">
          Do customers keep paying? <ValueKind kind="observed" />
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">Customers grouped by the month they first paid, and how many paid again in each month after.</p>
      </div>
      {data === undefined ? (
        <LoadingBlock label="Loading customer cohorts…" lines={3} />
      ) : data.rows.length === 0 ? (
        <Callout tone="info" title={data.hasCustomerIds ? "No paying customers in the last year yet" : "No customer-level billing data yet"}>
          Cohorts need payments that name the customer, from Stripe or a revenue file with a customer column.{" "}
          <Link href={`/app/${slug}/connections`}>Connect billing data</Link>.
        </Callout>
      ) : (
        <>
          {latestFull ? (
            <p className="text-sm text-ink">
              Of the {formatNumber(latestFull.size)} customers who first paid in {monthLabel(latestFull.cohort)},{" "}
              <strong className="font-semibold">{formatPercent(latestFull.retention[1] ?? 0, 0)}</strong> paid again the next month.
            </p>
          ) : null}
          <CohortTable data={data} />
          <Definition>
            A customer belongs to the month of their first payment in {data.currency}. Each later column shows the share of that group with at least one payment that
            month, after refunds. A dot means that month isn&apos;t over yet, so newer groups never look like they left.
            {data.truncated ? " Only the most recent 10,000 payments are included." : ""}
          </Definition>
        </>
      )}
    </section>
  );
}
