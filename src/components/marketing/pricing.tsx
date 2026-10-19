import { isUnlimited } from "../../../shared/economics/credits";
import Link from "next/link";
import { Check } from "@/components/icons"
import { CREDIT_EXAMPLES } from "@shared/economics";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { Table, TableFrame, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { cn, formatNumber, formatUsd } from "@/lib/utils";
import { COMPARISON_ROWS, getTiers, RECOMMENDED_TIER, tierHref, type Tier } from "./plans";

/** "Recommended" marker sitting on the top edge of a card (the card must be `relative`). */
export function RecommendedBadge() {
  return (
    <Badge tone="brand" className="absolute -top-2.5 left-5 ring-1 ring-surface">
      Most popular
    </Badge>
  );
}

const TIER_POINTS: Record<Tier["key"], string[]> = {
  free: ["All 10 AI roles on Climb AI Basic", "Business research and a growth plan", "Drafts you copy and post"],
  starter: ["Climb AI Expert", "Autopilot, publishing and sending", "Top-ups when you need more"],
  pro: ["Everything in Starter", "Unlimited people and workspaces", "For agencies and several brands"],
};

function TierCard({ tier }: { tier: Tier }) {
  const recommended = tier.key === RECOMMENDED_TIER;
  return (
    <li className={cn("relative flex flex-col rounded-xl border bg-surface p-5", recommended ? "border-brand-800 ring-1 ring-brand-800" : "border-line")}>
      {recommended ? <RecommendedBadge /> : null}
      <h3 className="heading-section">{tier.name}</h3>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="metric">{tier.priceUsd ? formatUsd(tier.priceUsd) : "$0"}</span>
        <span className="text-sm text-ink-3">{tier.priceUsd ? " / month" : ""}</span>
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-brand-800">
        {formatNumber(tier.credits)} credits <span className="text-sm font-normal text-ink-3">{tier.creditsNote}</span>
      </p>
      <p className="mt-2 min-h-[2lh] text-sm text-ink-2">{tier.tagline}</p>
      <Link href={tierHref(tier.key)} className={buttonClasses({ variant: recommended ? "primary" : "secondary", size: "lg", className: "mt-4 w-full" })}>
        {tier.key === "free" ? "Start free" : `Choose ${tier.name}`}
      </Link>
      <ul className="mt-5 flex flex-col gap-2 text-sm text-ink-2">
        {[...TIER_POINTS[tier.key], `${isUnlimited(tier.people) ? "Unlimited people" : `${tier.people} ${tier.people === 1 ? "person" : "people"}`} · ${isUnlimited(tier.workspaces) ? "unlimited workspaces" : `${tier.workspaces} workspace${tier.workspaces === 1 ? "" : "s"}`}`].map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />
            {h}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Free + monthly packages, from the credits registry. */
export function PlanCards() {
  return (
    <ul className="mx-auto grid max-w-5xl gap-4 pt-3 md:grid-cols-3">
      {getTiers().map((t) => (
        <TierCard key={t.key} tier={t} />
      ))}
    </ul>
  );
}

/** Accessible comparison table (scrolls inside its own region on small screens). */
export function PlanComparison({ headingId }: { headingId: string }) {
  const tiers = getTiers();
  return (
    <TableFrame role="region" aria-labelledby={headingId} tabIndex={0} className="mt-8">
      <Table className="min-w-[640px]">
        <caption className="sr-only">What Free, Starter and Pro include.</caption>
        <THead>
          <tr>
            <Th className="sticky left-0 bg-surface-2">Feature</Th>
            {tiers.map((t) => (
              <Th key={t.key} className="py-2 text-ink">
                {t.name}
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
              {tiers.map((t) => (
                <Td key={t.key} className="align-top text-ink-2">
                  {row.value(t)}
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}

/** "What things cost": the most each action can use, from the live estimates. */
export function CreditExamples({ headingId }: { headingId: string }) {
  return (
    <TableFrame role="region" aria-labelledby={headingId} tabIndex={0} className="mt-8">
      <Table className="min-w-[480px]">
        <caption className="sr-only">The most credits each action can use. Jobs charge only what they actually use.</caption>
        <THead>
          <tr>
            <Th>Action</Th>
            <Th className="text-right">Basic</Th>
            <Th className="text-right">Expert</Th>
          </tr>
        </THead>
        <TBody>
          {CREDIT_EXAMPLES.map((e) => (
            <Tr key={e.kind}>
              <Td className="text-ink">{e.label}</Td>
              <Td className="text-right tabular-nums text-ink-2">up to {formatNumber(e.basic)}</Td>
              <Td className="text-right tabular-nums text-ink-2">{e.expert !== undefined ? `up to ${formatNumber(e.expert)}` : "same"}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}
