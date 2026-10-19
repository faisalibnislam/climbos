"use client";

import { CircleAlert, CircleCheck, Crosshair, Workflow } from "@/components/icons"
import { Scannable } from "@/components/ds/content";
import Link from "next/link";
import { useState } from "react";
import { Badge, Callout, CellStack, SocialIcon, Table, TableFrame, TBody, Td, Th, THead, Tr, buttonClasses, networkOf } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { minorToDisplay } from "../money";
import { CHANNEL_LABELS } from "../roles";
import { formatPercent, longDate } from "./format";
import { Definition, ValueKind } from "./Provenance";
import type { Overview } from "./ResultsView";
import { Segmented } from "@/components/ui/segmented";

type Attr = NonNullable<Overview["attribution"]["lastTouch"]>;
type Model = "last_touch" | "first_touch";

/** Row-header cell matching <Td> sizing. */
const rowHeader = "h-11 px-4 py-2 text-left align-middle font-medium text-ink";

export function channelLabel(channel: string): string {
  const known = CHANNEL_LABELS[channel];
  if (known) return known;
  const clean = channel.replace(/[_-]+/g, " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Unknown";
}

/** Heuristic: channels credited from paid-ad tracked links ("google ads", "cpc", "paid social"…). */
function isAdChannel(channel: string): boolean {
  return /\bads?\b|cpc|ppc|paid/i.test(channel);
}

function ReconcileBadge({ reconciled }: { reconciled: boolean }) {
  return reconciled ? (
    <Badge tone="green" icon={<CircleCheck />}>
      Matches billing
    </Badge>
  ) : (
    <Badge tone="red" icon={<CircleAlert />}>
      Doesn&apos;t reconcile
    </Badge>
  );
}

function AttributionTable({ group, model }: { group: Attr["byCurrency"][number]; model: Model }) {
  const total = group.totalNetBillingMinor;
  const share = (minor: number) => (total !== 0 ? formatPercent(minor / total) : "—");
  const fmt = (m: number) => minorToDisplay(m, group.currency);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ReconcileBadge reconciled={group.reconciled} />
        <span className="text-xs text-ink-3">{group.currency}</span>
      </div>
      <TableFrame>
        <Table>
          <caption className="sr-only">
            Revenue by channel, {model === "last_touch" ? "last-touch" : "first-touch"} attribution, {group.currency}
          </caption>
          <THead>
            <tr>
              <Th>Channel</Th>
              <Th numeric>Net revenue</Th>
              <Th numeric>Customers</Th>
              <Th numeric>Share</Th>
            </tr>
          </THead>
          <TBody>
            {group.channels.map((c) => (
              <Tr key={c.channel}>
                <th scope="row" className={rowHeader}>
                  <span className="inline-flex items-center gap-2">
                    {networkOf(c.channel) ? <SocialIcon network={c.channel} size="sm" /> : null}
                    {channelLabel(c.channel)}
                  </span>
                </th>
                <Td numeric>{fmt(c.netRevenueMinor)}</Td>
                <Td numeric>{formatNumber(c.conversions)}</Td>
                <Td numeric>{share(c.netRevenueMinor)}</Td>
              </Tr>
            ))}
            <Tr className="bg-surface-2/60">
              <th scope="row" className={rowHeader}>
                <CellStack primary="Unattributed" secondary="No tracked link in 30 days" />
              </th>
              <Td numeric>{fmt(group.unattributed.netRevenueMinor)}</Td>
              <Td numeric>{formatNumber(group.unattributed.conversions)}</Td>
              <Td numeric>{share(group.unattributed.netRevenueMinor)}</Td>
            </Tr>
          </TBody>
          <tfoot className="border-t border-line bg-surface-2 font-semibold">
            <tr>
              <th scope="row" className={rowHeader}>
                Billing total
              </th>
              <Td numeric>{fmt(total)}</Td>
              <Td numeric>{formatNumber(group.channels.reduce((s, c) => s + c.conversions, 0) + group.unattributed.conversions)}</Td>
              <Td numeric>{total !== 0 ? "100%" : "—"}</Td>
            </tr>
          </tfoot>
        </Table>
      </TableFrame>
      {!group.reconciled ? (
        <p className="text-ui font-medium text-red-800">Rows don&apos;t add up to the {group.currency} billing total. Use with caution.</p>
      ) : null}
    </div>
  );
}

export function AttributionSection({ slug, data }: { slug: string; data: Overview }) {
  const [model, setModel] = useState<Model>("last_touch");
  const attr = model === "last_touch" ? data.attribution.lastTouch : data.attribution.firstTouch;
  return (
    <section aria-labelledby="attribution-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="attribution-heading" className="heading-section flex flex-wrap items-center gap-2">
          <Workflow aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> Revenue by channel <ValueKind kind="attributed" />
        </h2>
        <Segmented
          label="Attribution model"
          value={model}
          onChange={setModel}
          options={[
            { value: "last_touch", label: "Last touch" },
            { value: "first_touch", label: "First touch" },
          ]}
        />
      </div>
      {!attr ? (
        <Callout tone="info" title="No billing revenue yet">
          <Link href={`/app/${slug}/connections`}>Connect billing data</Link>
        </Callout>
      ) : (
        <div className="flex flex-col gap-5">
          {attr.byCurrency.map((g) => (
            <AttributionTable key={g.currency} group={g} model={model} />
          ))}
        </div>
      )}
      <Definition summary="How credit works">
        <p>{model === "last_touch" ? "Last touch: last tracked channel before purchase." : "First touch: first tracked channel that brought them in."}</p>
        <Scannable text={data.attribution.note} max={4} tone="muted" className="mt-2" />
      </Definition>
    </section>
  );
}

const PLATFORM_LABELS: Record<string, string> = { google_ads: "Google Ads", meta_ads: "Meta Ads" };

export function PlatformClaimsSection({ slug, data }: { slug: string; data: Overview }) {
  const claims = data.platformClaims;
  const currency = data.currency;
  const group = data.attribution.lastTouch?.byCurrency.find((g) => g.currency === currency);
  const adRevenue = group ? group.channels.filter((c) => isAdChannel(c.channel)).reduce((s, c) => s + c.netRevenueMinor, 0) : 0;
  const spend = claims?.adSpendMinor ?? 0;
  const roas = spend > 0 && adRevenue > 0 ? adRevenue / spend : null;

  return (
    <section aria-labelledby="claims-heading" className="flex flex-col gap-4 rounded-xl border border-dashed border-line-strong bg-surface-2/60 p-5">
      <h2 id="claims-heading" className="heading-section flex flex-wrap items-center gap-2">
        <Crosshair aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> What ad platforms say <ValueKind kind="platform_reported" />
      </h2>
      {!claims ? (
        <p className="text-sm text-ink-2">
          No ad data. <Link className={buttonClasses({ variant: "link" })} href={`/app/${slug}/connections`}>Connect Google or Meta Ads</Link>
        </p>
      ) : (
        <>
          <Callout tone="warning" title="Don't add these together">
            They overlap and aren&apos;t billing revenue.
          </Callout>
          <ul className="grid gap-3 sm:grid-cols-2">
            {claims.platforms.map((p) => (
              <li key={p.platform} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
                <h3 className="heading-card flex items-center gap-2">
                  <SocialIcon network={p.platform === "google_ads" ? "google" : p.platform === "meta_ads" ? "facebook" : p.platform} size="sm" />
                  {PLATFORM_LABELS[p.platform] ?? p.platform}
                </h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui">
                  <dt className="text-ink-3">Conversions</dt>
                  <dd className="text-right font-medium tabular-nums text-ink">{formatNumber(p.conversions)}</dd>
                  {Object.entries(p.conversionValueMinorByCurrency).map(([cur, v]) => (
                    <div key={cur} className="contents">
                      <dt className="text-ink-3">Value ({cur})</dt>
                      <dd className="text-right font-medium tabular-nums text-ink">{minorToDisplay(v, cur)}</dd>
                    </div>
                  ))}
                  <dt className="text-ink-3">Days</dt>
                  <dd className="text-right tabular-nums text-ink" title={p.firstDate && p.lastDate ? `${longDate(p.firstDate)} – ${longDate(p.lastDate)}` : undefined}>
                    {p.days}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <h3 className="heading-card">Return on ad spend</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui">
              <dt className="text-ink-3">Ad spend ({currency})</dt>
              <dd className="text-right font-medium tabular-nums text-ink">{minorToDisplay(spend, currency)}</dd>
              <dt className="text-ink-3">Revenue credited to ads</dt>
              <dd className="text-right font-medium tabular-nums text-ink">{minorToDisplay(adRevenue, currency)}</dd>
              <dt className="text-ink-3">ROAS</dt>
              <dd className="text-right font-semibold tabular-nums text-ink">{roas !== null ? `${roas.toFixed(2)}×` : "—"}</dd>
            </dl>
            {roas === null ? (
              <p className="text-xs text-ink-3">
                {spend <= 0 ? "No ad spend this period." : "No revenue credited to ads yet. Add UTM tags."}
              </p>
            ) : null}
            <Definition summary="ROAS vs ROI">
              <p>
                <strong className="font-semibold">ROAS</strong> = billing revenue credited to ads (last touch) ÷ ad spend.
              </p>
              <p className="mt-1">
                <strong className="font-semibold">ROI</strong> also subtracts your other costs, which ClimbOS doesn&apos;t know, so it isn&apos;t shown. Neither proves cause.
              </p>
            </Definition>
          </div>
        </>
      )}
    </section>
  );
}
