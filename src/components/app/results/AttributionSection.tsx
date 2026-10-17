"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
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
      Matches billing total
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
        <span className="text-xs text-ink-3">Amounts in {group.currency}</span>
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
              <Th numeric>Paying customers</Th>
              <Th numeric>Share of billing</Th>
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
                <CellStack primary="Unattributed" secondary="No tracked link within 30 days" />
              </th>
              <Td numeric>{fmt(group.unattributed.netRevenueMinor)}</Td>
              <Td numeric>{formatNumber(group.unattributed.conversions)}</Td>
              <Td numeric>{share(group.unattributed.netRevenueMinor)}</Td>
            </Tr>
          </TBody>
          <tfoot className="border-t border-line bg-surface-2 font-semibold">
            <tr>
              <th scope="row" className={rowHeader}>
                Billing total (observed)
              </th>
              <Td numeric>{fmt(total)}</Td>
              <Td numeric>{formatNumber(group.channels.reduce((s, c) => s + c.conversions, 0) + group.unattributed.conversions)}</Td>
              <Td numeric>{total !== 0 ? "100%" : "—"}</Td>
            </tr>
          </tfoot>
        </Table>
      </TableFrame>
      {!group.reconciled ? (
        <p className="text-ui font-medium text-red-800">
          The channel rows plus Unattributed don&apos;t add up to the billing total for {group.currency}. Treat these channel numbers with caution until this is
          fixed.
        </p>
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
        <div>
          <h2 id="attribution-heading" className="heading-section flex flex-wrap items-center gap-2">
            Where revenue came from <ValueKind kind="attributed" />
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Billing revenue, credited to the channel a customer came through.</p>
        </div>
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
      <p className="text-ui text-ink-3">
        {model === "last_touch"
          ? "Last touch: credit goes to the last tracked channel before the purchase."
          : "First touch: credit goes to the first tracked channel that brought the customer in."}
      </p>
      {!attr ? (
        <Callout tone="info" title="No billing revenue in this period yet">
          Attribution starts once revenue arrives from Stripe or a revenue file. <Link href={`/app/${slug}/connections`}>Connect billing data</Link>.
        </Callout>
      ) : (
        <div className="flex flex-col gap-5">
          {attr.byCurrency.map((g) => (
            <AttributionTable key={g.currency} group={g} model={model} />
          ))}
        </div>
      )}
      <Callout tone="info" title="Association, not cause">
        {data.attribution.note}
      </Callout>
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
      <div>
        <h2 id="claims-heading" className="heading-section flex flex-wrap items-center gap-2">
          What ad platforms say <ValueKind kind="platform_reported" />
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">Kept separate from your billing numbers on purpose.</p>
      </div>
      {!claims ? (
        <p className="text-sm text-ink-2">
          No ad platform data in this period. <Link className={buttonClasses({ variant: "link" })} href={`/app/${slug}/connections`}>Connect Google Ads or Meta Ads</Link> to see what they report.
        </p>
      ) : (
        <>
          <Callout tone="warning" title="Don't add these together">
            {claims.warning}
          </Callout>
          <ul className="grid gap-3 sm:grid-cols-2">
            {claims.platforms.map((p) => (
              <li key={p.platform} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
                <h3 className="heading-card flex items-center gap-2">
                  <SocialIcon network={p.platform === "google_ads" ? "google" : p.platform === "meta_ads" ? "facebook" : p.platform} size="sm" />
                  {PLATFORM_LABELS[p.platform] ?? p.platform}
                </h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui">
                  <dt className="text-ink-3">Claimed conversions</dt>
                  <dd className="text-right font-medium tabular-nums text-ink">{formatNumber(p.conversions)}</dd>
                  {Object.entries(p.conversionValueMinorByCurrency).map(([cur, v]) => (
                    <div key={cur} className="contents">
                      <dt className="text-ink-3">Claimed value ({cur})</dt>
                      <dd className="text-right font-medium tabular-nums text-ink">{minorToDisplay(v, cur)}</dd>
                    </div>
                  ))}
                  <dt className="text-ink-3">Days reported</dt>
                  <dd className="text-right tabular-nums text-ink">
                    {p.days}
                    {p.firstDate && p.lastDate ? ` (${longDate(p.firstDate)} – ${longDate(p.lastDate)})` : ""}
                  </dd>
                </dl>
                <p className="text-xs text-ink-3">Counted by {PLATFORM_LABELS[p.platform] ?? p.platform} under its own attribution rules.</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <h3 className="heading-card">Return on ad spend</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ui">
              <dt className="text-ink-3">Ad spend (observed, {currency})</dt>
              <dd className="text-right font-medium tabular-nums text-ink">{minorToDisplay(spend, currency)}</dd>
              <dt className="text-ink-3">Billing revenue credited to ad channels (attributed, last touch)</dt>
              <dd className="text-right font-medium tabular-nums text-ink">{minorToDisplay(adRevenue, currency)}</dd>
              <dt className="text-ink-3">ROAS</dt>
              <dd className="text-right font-semibold tabular-nums text-ink">{roas !== null ? `${roas.toFixed(2)}×` : "Not available"}</dd>
            </dl>
            {roas === null ? (
              <p className="text-xs text-ink-3">
                {spend <= 0 ? "No ad spend recorded in this period." : "No billing revenue is credited to an ad channel yet. Tracked links (UTM tags) on your ads make this possible."}
              </p>
            ) : null}
            <Definition summary="ROAS vs ROI">
              <p>
                <strong className="font-semibold">ROAS</strong> (return on ad spend) = attributed billing revenue ÷ ad spend. 3.0× means $3 of revenue credited to ads for every $1 spent. It
                uses your billing revenue, not the platforms&apos; claimed values.
              </p>
              <p className="mt-1">
                <strong className="font-semibold">ROI</strong> is different: (revenue − ad spend − all other costs) ÷ total cost. ClimbOS doesn&apos;t know your product costs, fees or
                staff time, so it doesn&apos;t show ROI. Neither number proves the ads caused the sales.
              </p>
            </Definition>
          </div>
        </>
      )}
    </section>
  );
}
