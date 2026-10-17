import Link from "next/link";
import { Check } from "lucide-react";
import type { PlanEntitlement } from "@shared/economics";
import { buttonClasses } from "@/components/ui/button-styles";
import { cn, formatUsd } from "@/lib/utils";
import { autonomyLine, COMPARISON_ROWS, getPlans, planHref, planLimitLines, RECOMMENDED_PLAN } from "./plans";

function PlanCard({ plan }: { plan: PlanEntitlement }) {
  const recommended = plan.key === RECOMMENDED_PLAN;
  const headingId = `plan-${plan.key}`;
  return (
    <li
      className={cn(
        "relative flex flex-col rounded-[var(--radius-lg)] border bg-surface p-6 shadow-sm",
        recommended ? "border-green-800 ring-1 ring-green-800" : "border-line",
      )}
    >
      {recommended ? (
        <p className="absolute -top-3 left-6 rounded-full bg-green-800 px-3 py-0.5 text-xs font-semibold text-white">
          Recommended for small teams
        </p>
      ) : null}
      <h3 id={headingId} className="text-xl font-semibold text-ink">
        {plan.name}
      </h3>
      <p className="mt-3">
        <span className="font-display text-4xl font-semibold tracking-tight text-ink">{formatUsd(plan.priceUsd)}</span>
        <span className="text-ink-3"> / month</span>
      </p>
      <p className="mt-3 min-h-[3lh] text-[0.95rem] leading-relaxed text-ink-2">{plan.tagline}</p>
      <Link
        href={planHref(plan.key)}
        className={buttonClasses({ variant: recommended ? "primary" : "secondary", className: "mt-5 w-full" })}
      >
        Choose {plan.name}
        <span className="sr-only"> — {formatUsd(plan.priceUsd)} a month</span>
      </Link>
      <p className="mt-5 text-sm font-semibold text-ink">{autonomyLine(plan)}</p>
      <ul className="mt-3 flex flex-col gap-2 text-[0.95rem] text-ink-2">
        <li className="flex items-start gap-2">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green-700" />
          All 10 AI growth roles
        </li>
        {planLimitLines(plan).map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green-700" />
            {line}
          </li>
        ))}
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green-700" />
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
    <ul className="grid gap-5 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
    <div
      role="region"
      aria-labelledby={headingId}
      tabIndex={0}
      className="mt-8 overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-surface"
    >
      <table className="w-full min-w-[760px] border-collapse text-left text-[0.95rem]">
        <caption className="sr-only">
          Monthly limits and features for each ClimbOS plan. All limits are monthly maximums.
        </caption>
        <thead>
          <tr className="border-b border-line bg-surface-2/70">
            <th scope="col" className="sticky left-0 bg-surface-2 px-4 py-3 text-sm font-semibold text-ink-2">
              Feature
            </th>
            {plans.map((p) => (
              <th key={p.key} scope="col" className="px-4 py-3 font-semibold text-ink">
                {p.name}
                {p.key === RECOMMENDED_PLAN ? (
                  <span className="block text-xs font-medium text-green-800">Recommended for small teams</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-b-0">
              <th scope="row" className="sticky left-0 max-w-56 bg-surface px-4 py-3 align-top font-medium text-ink">
                {row.label}
                {row.hint ? <span className="block text-sm font-normal text-ink-3">{row.hint}</span> : null}
              </th>
              {plans.map((p) => (
                <td key={p.key} className="px-4 py-3 align-top tabular-nums text-ink-2">
                  {row.value(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
