import Link from "next/link";
import { Check } from "lucide-react";
import type { PlanEntitlement } from "@shared/economics";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { Table, TableFrame, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { cn, formatUsd } from "@/lib/utils";
import { autonomyLine, COMPARISON_ROWS, getPlans, planHref, planLimitLines, RECOMMENDED_PLAN } from "./plans";

/** "Recommended" marker sitting on the top edge of a plan card (the card must be `relative`). */
export function RecommendedBadge() {
  return (
    <Badge tone="brand" className="absolute -top-2.5 left-5 ring-1 ring-surface">
      Recommended for small teams
    </Badge>
  );
}

function PlanCard({ plan }: { plan: PlanEntitlement }) {
  const recommended = plan.key === RECOMMENDED_PLAN;
  const headingId = `plan-${plan.key}`;
  return (
    <li
      className={cn(
        "relative flex flex-col rounded-xl border bg-surface p-5",
        recommended ? "border-brand-800 ring-1 ring-brand-800" : "border-line",
      )}
    >
      {recommended ? <RecommendedBadge /> : null}
      <h3 id={headingId} className="heading-section">
        {plan.name}
      </h3>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="metric">{formatUsd(plan.priceUsd)}</span>
        <span className="text-sm text-ink-3"> / month</span>
      </p>
      <p className="mt-2 min-h-[3lh] text-sm text-ink-2">{plan.tagline}</p>
      <Link
        href={planHref(plan.key)}
        className={buttonClasses({ variant: recommended ? "primary" : "secondary", size: "lg", className: "mt-4 w-full" })}
      >
        Choose {plan.name}
        <span className="sr-only"> — {formatUsd(plan.priceUsd)} a month</span>
      </Link>
      <p className="mt-5 heading-card">{autonomyLine(plan)}</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-2">
        <li className="flex items-start gap-2">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />
          All 10 AI growth roles
        </li>
        {planLimitLines(plan).map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />
            {line}
          </li>
        ))}
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />
            {h}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Grid of plan cards, data from CURRENT_ENTITLEMENTS. */
export function PlanCards() {
  const plans = getPlans();
  return (
    <ul className="grid gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {plans.map((p) => (
        <PlanCard key={p.key} plan={p} />
      ))}
    </ul>
  );
}

/** Accessible comparison table (scrolls inside its own region on small screens). */
export function PlanComparison({ headingId }: { headingId: string }) {
  const plans = getPlans();
  return (
    <TableFrame role="region" aria-labelledby={headingId} tabIndex={0} className="mt-8">
      <Table className="min-w-[760px]">
        <caption className="sr-only">
          Monthly limits and features for each ClimbOS plan. All limits are monthly maximums.
        </caption>
        <THead>
          <tr>
            <Th className="sticky left-0 bg-surface-2">Feature</Th>
            {plans.map((p) => (
              <Th key={p.key} className="py-2 text-ink">
                {p.name}
                {p.key === RECOMMENDED_PLAN ? (
                  <span className="block font-normal text-brand-800">Recommended for small teams</span>
                ) : null}
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {COMPARISON_ROWS.map((row) => (
            <Tr key={row.label}>
              <Th scope="row" className="sticky left-0 h-11 max-w-56 whitespace-normal bg-surface py-2 align-top text-ui text-ink">
                {row.label}
                {row.hint ? <span className="block text-xs font-normal text-ink-3">{row.hint}</span> : null}
              </Th>
              {plans.map((p) => (
                <Td key={p.key} className="align-top tabular-nums text-ink-2">
                  {row.value(p)}
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}
