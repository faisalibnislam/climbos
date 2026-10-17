"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { CircleCheck, ExternalLink, FlaskConical } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge, Button, Callout, DataTable, Meter } from "@/components/ui";
import { cn, formatNumber, formatUsd } from "@/lib/utils";
import { errorMessage } from "../errors";
import { minorToDisplay } from "../money";
import { LoadingBlock } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";

type Billing = FunctionReturnType<typeof api.billing.overview>;
type ProductKey = "basic" | "starter" | "growth" | "pro" | "business" | "boost_29";

function dateOnly(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const STATUS_TEXT: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  revoked: "Ended",
  incomplete: "Waiting for payment confirmation",
};

const ORDER_STATUS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
};

export function BillingSettings({ slug }: { slug: string }) {
  const data = useQuery(api.billing.overview, { slug });
  const createCheckout = useAction(api.billing.createCheckout);
  const portal = useAction(api.billing.customerPortal);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(key: string, fn: () => Promise<{ url: string }>) {
    setBusy(key);
    setError(null);
    try {
      const { url } = await fn();
      window.location.href = url;
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }
  const checkout = (productKey: ProductKey) => go(productKey, () => createCheckout({ slug, productKey }));
  const openPortal = () => go("portal", () => portal({ slug }));

  return (
    <div className="flex flex-col gap-8">
      <SettingsHeader
        title="Billing"
        intro="Your plan, what's included and how much is left this month. Payments are handled by Polar."
        actions={
          data?.environment === "sandbox" && data.billingConfigured ? (
            <Badge tone="violet" icon={<FlaskConical />}>
              Sandbox — test payments only
            </Badge>
          ) : null
        }
      />
      <Suspense fallback={null}>
        <CheckoutReturnNotice />
      </Suspense>
      <div aria-live="polite">
        {error ? (
          <Callout tone="danger" live="none" title="That didn't open">
            {error}
          </Callout>
        ) : null}
      </div>
      {data === undefined ? (
        <LoadingBlock label="Loading billing…" lines={4} />
      ) : (
        <BillingBody data={data} busy={busy} onCheckout={checkout} onPortal={openPortal} />
      )}
    </div>
  );
}

function CheckoutReturnNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  if (params.get("checkout") !== "returned") return null;
  return (
    <Callout
      tone="info"
      live="status"
      title="We're confirming your payment with Polar"
      action={
        <Button variant="secondary" size="sm" onClick={() => router.replace(pathname)}>
          Dismiss
        </Button>
      }
    >
      Access starts as soon as Polar confirms (usually under a minute). This page updates by itself — you don&apos;t need to refresh or pay again.
    </Callout>
  );
}

function BillingBody({
  data,
  busy,
  onCheckout,
  onPortal,
}: {
  data: Billing;
  busy: string | null;
  onCheckout: (k: ProductKey) => void;
  onPortal: () => void;
}) {
  const sub = data.subscription;
  const subscribed = sub !== null && (sub.access === "full" || sub.access === "grace_read_only" || sub.access === "pending");
  const currentPlan = data.plans.find((p) => p.key === (sub?.planKey ?? data.period?.planKey));
  const blocked = data.isDemo ? "Demo workspaces can't buy plans. Create your own workspace first." : !data.canManage ? "Only owners and admins can change billing." : null;
  const canBuy = data.billingConfigured && !blocked;

  return (
    <>
      {!data.billingConfigured ? (
        <Callout tone="info" title="Billing is being set up">
          ClimbOS hasn&apos;t finished connecting its payment system yet, so plans can&apos;t be bought right now. Nothing is charged in the meantime. Your current
          allowance is shown below.
        </Callout>
      ) : null}
      {blocked ? <Callout tone="info">{blocked}</Callout> : null}

      {/* Current plan + access state */}
      <section aria-labelledby="plan-heading" className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="plan-heading" className="text-lg font-semibold text-ink">
            {currentPlan ? `${currentPlan.name} plan` : "No plan yet"}
          </h2>
          {sub ? <Badge tone={sub.access === "full" ? "green" : sub.access === "grace_read_only" ? "amber" : "neutral"}>{STATUS_TEXT[sub.status] ?? sub.status}</Badge> : null}
        </div>
        {sub ? <SubscriptionMessage sub={sub} /> : (
          <p className="text-ink-2">
            {data.period?.source === "demo"
              ? "This demo workspace has a sample allowance."
              : data.period?.source === "onboarding"
                ? "You're using the starting allowance while you set up. Choose a plan to keep ClimbOS working after that."
                : "Choose a plan to start."}
          </p>
        )}
        {!data.canRunAi && data.accessMessage ? (
          <Callout tone="warning" title="New AI work is paused">
            {data.accessMessage}
          </Callout>
        ) : null}
        {sub && data.billingConfigured && data.canManage && !data.isDemo ? (
          <div>
            <Button variant="secondary" onClick={onPortal} loading={busy === "portal"} loadingText="Opening Polar…">
              Manage payment and invoices
              <ExternalLink aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </section>

      {/* Usage */}
      <section aria-labelledby="usage-heading" className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
        <div>
          <h2 id="usage-heading" className="text-lg font-semibold text-ink">
            This month&apos;s allowance
          </h2>
          {data.period ? (
            <p className="mt-0.5 text-sm text-ink-3">
              {dateOnly(data.period.startsAt)} – {dateOnly(data.period.endsAt)} · resets on {dateOnly(data.period.endsAt)}
            </p>
          ) : null}
        </div>
        {!data.period ? (
          <p className="text-ink-2">No allowance yet. It starts when your plan does.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {data.period.walletFraction === null ? (
              <div className="flex flex-col gap-0.5">
                <p className="text-[0.95rem] font-medium text-ink">AI work capacity</p>
                <p className="text-sm text-ink-2">Not applicable — this period has no AI work limit.</p>
              </div>
            ) : (
              <Meter
                label="AI work capacity"
                used={Math.min(100, Math.round(data.period.walletFraction * 100))}
                max={100}
                unit="percent"
                footnote="Shown as a share of this month's AI allowance (research, writing and analysis), including work in progress."
              />
            )}
            {data.period.topupFraction !== null ? (
              <Meter
                label="Extra capacity pack"
                used={Math.min(100, Math.round(data.period.topupFraction * 100))}
                max={100}
                unit="percent"
                footnote="Used only after your monthly allowance runs out."
              />
            ) : null}
            {data.period.meters.map((m) => (
              <Meter
                key={m.key}
                label={m.label}
                used={m.used + m.reserved}
                max={m.cap}
                footnote={m.reserved > 0 ? `Includes ${formatNumber(m.reserved)} held for work in progress.` : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Top-up */}
      {data.topupProducts.length > 0 ? (
        <section aria-labelledby="topup-heading" className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <h2 id="topup-heading" className="text-lg font-semibold text-ink">
            Need more this month?
          </h2>
          {data.topupProducts.map((t) => {
            const disabled = !canBuy || !t.available || sub?.access !== "full";
            return (
              <div key={t.key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-ink">
                    {t.name} — {formatUsd(t.priceUsd)}
                  </p>
                  <p className="text-sm leading-relaxed text-ink-2">{t.description}</p>
                  <p className="text-sm font-medium text-ink-2">Bought only when you click; never automatic.</p>
                  {sub?.access !== "full" ? <p className="text-sm text-ink-3">Available once you have an active plan.</p> : null}
                </div>
                <Button variant="secondary" disabled={disabled} loading={busy === t.key} loadingText="Opening checkout…" onClick={() => onCheckout(t.key as ProductKey)}>
                  Buy {t.name}
                </Button>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Plans */}
      <section aria-labelledby="plans-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="plans-heading" className="text-lg font-semibold text-ink">
            Plans
          </h2>
          <p className="mt-0.5 text-ink-2">Monthly prices in US dollars. Change or cancel at any time.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.plans.map((p) => {
            const isCurrent = sub?.access === "full" && sub.planKey === p.key;
            return (
              <li key={p.key} className={cn("flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-surface p-5", isCurrent ? "border-brand-800 ring-1 ring-brand-800" : "border-line")}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-ink">{p.name}</h3>
                  {isCurrent ? (
                    <Badge tone="green" icon={<CircleCheck />}>
                      Your plan
                    </Badge>
                  ) : null}
                </div>
                <p className="font-display tracking-tight text-3xl font-extrabold text-ink">
                  {formatUsd(p.priceUsd)}
                  <span className="text-base font-normal text-ink-3"> / month</span>
                </p>
                <p className="text-sm leading-relaxed text-ink-2">{p.tagline}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {p.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                  <li>
                    {formatNumber(p.caps.socialPosts)} social posts · {formatNumber(p.caps.deliveredImages)} images a month
                  </li>
                </ul>
                <div className="mt-auto pt-2">
                  {isCurrent ? null : subscribed ? (
                    <Button variant="secondary" className="w-full" disabled={!canBuy} loading={busy === "portal"} onClick={onPortal}>
                      Switch in billing portal
                    </Button>
                  ) : (
                    <Button className="w-full" disabled={!canBuy || !p.available} loading={busy === p.key} loadingText="Opening checkout…" onClick={() => onCheckout(p.key as ProductKey)}>
                      Choose {p.name}
                    </Button>
                  )}
                  {!p.available && data.billingConfigured && !isCurrent ? <p className="mt-1 text-sm text-ink-3">Not available to buy yet.</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* History */}
      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-lg font-semibold text-ink">
          Payment history
        </h2>
        <DataTable
          caption="Recent payments confirmed by Polar"
          hideCaption
          columns={[
            { key: "date", header: "Date", rowHeader: true, cell: (o) => dateOnly(o.createdAt) },
            { key: "product", header: "For", cell: (o) => data.plans.find((p) => p.key === o.productKey)?.name ?? (o.productKey === "boost_29" ? "Extra capacity pack" : o.productKey) },
            { key: "amount", header: "Amount", align: "right", cell: (o) => minorToDisplay(o.amountMinor, o.currency.toUpperCase()) },
            { key: "status", header: "Status", cell: (o) => ORDER_STATUS[o.status] ?? o.status },
          ]}
          rows={data.orders}
          rowKey={(o) => o.id}
          emptyText="No payments yet."
        />
      </section>
    </>
  );
}

function SubscriptionMessage({ sub }: { sub: NonNullable<Billing["subscription"]> }) {
  if (sub.access === "grace_read_only") {
    return (
      <Callout tone="warning" title="We couldn't take your last payment">
        You can still view and export everything, but ClimbOS won&apos;t start new work until the payment method is updated in the billing portal.
      </Callout>
    );
  }
  if (sub.access === "pending") {
    return <p className="text-ink-2">Waiting for Polar to confirm your payment. Access starts as soon as it does.</p>;
  }
  if (sub.access === "ended") {
    return <p className="text-ink-2">Your plan has ended. Your data is still here — choose a plan to start ClimbOS working again.</p>;
  }
  if (sub.cancelAtPeriodEnd) {
    return (
      <p className="text-ink-2">
        Cancelled — you keep full access until <strong className="text-ink">{dateOnly(sub.currentPeriodEnd)}</strong>. Nothing more will be charged.
      </p>
    );
  }
  return <p className="text-ink-2">Renews on {dateOnly(sub.currentPeriodEnd)}.</p>;
}
