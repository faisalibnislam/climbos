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
type ProductKey = "starter" | "pro" | "credits_10" | "credits_25" | "credits_50";

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
        intro="Your credits, package and top-ups. Credits are shared by every workspace on your account. Payments are handled by Polar."
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
  const b = data.balance;
  const canBuy = data.canManage && !data.isDemo && data.billingConfigured;
  return (
    <>
      {!data.canRunAi && data.accessMessage ? (
        <Callout tone="warning" live="none" title="New work is paused">
          {data.accessMessage}
        </Callout>
      ) : null}

      <section aria-labelledby="credits-heading" className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="credits-heading" className="heading-section">
            Credits
          </h2>
          <span className="text-2xl font-semibold tabular-nums text-ink">{formatNumber(b.available)} left</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Meter
            label={data.paid ? "This month" : "Free credits"}
            used={b.monthly.used}
            max={Math.max(b.monthly.total, 1)}
            unit="credits"
          />
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Top-ups</span>
            <span className="text-ink-2">{b.topup.left > 0 ? `${formatNumber(b.topup.left)} credits` : "None"}</span>
            {b.topup.nextExpiry ? <span className="text-xs text-ink-3">Oldest expire {dateOnly(b.topup.nextExpiry)}</span> : null}
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-3">
          {b.resetsAt ? `Monthly credits reset on ${dateOnly(b.resetsAt)}; unused ones don't carry over. ` : ""}Top-up credits last 12 months and are used after the month&apos;s credits. Every
          job shows its credits before it starts and only charges what it used.
          {b.workspace.cap !== null ? ` This workspace: ${formatNumber(b.workspace.used)} of its ${formatNumber(b.workspace.cap)} monthly cap used.` : ""}
        </p>
      </section>

      <section aria-labelledby="packages-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="packages-heading" className="heading-section">
            Monthly packages
          </h2>
          {sub ? (
            <span className="flex items-center gap-2 text-sm text-ink-2">
              {sub.name} · {STATUS_TEXT[sub.status] ?? sub.status}
              {sub.cancelAtPeriodEnd ? ` · ends ${dateOnly(sub.currentPeriodEnd)}` : ""}
              {data.canManage ? (
                <Button size="sm" variant="secondary" loading={busy === "portal"} onClick={onPortal}>
                  Manage <ExternalLink aria-hidden />
                </Button>
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {data.packages.map((p) => {
            const current = sub?.planKey === p.key && sub.access === "full";
            return (
              <div key={p.key} className={cn("flex flex-col gap-3 rounded-xl border bg-surface p-5", current ? "border-brand-800 ring-1 ring-brand-800" : "border-line")}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="heading-card">{p.name}</h3>
                  <span className="text-lg font-semibold text-ink">
                    {formatUsd(p.priceUsd)}
                    <span className="text-sm font-normal text-ink-3">/month</span>
                  </span>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-brand-800">{formatNumber(p.credits)} credits</p>
                <ul className="flex flex-col gap-1 text-sm text-ink-2">
                  {[
                    "Climb AI Expert",
                    "Autopilot, publishing and sending",
                    `${p.seats} people across your workspaces`,
                    "Top-ups when you need more",
                  ].map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-800" /> {h}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <Badge tone="green">Your package</Badge>
                ) : (
                  <Button disabled={!canBuy || !p.available} loading={busy === p.key} onClick={() => onCheckout(p.key as ProductKey)}>
                    {sub && sub.access === "full" ? `Switch to ${p.name}` : `Choose ${p.name}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-3">Free: {formatNumber(data.freeCredits)} credits once, 1 workspace, 1 person, Climb AI Basic, drafts you copy yourself.</p>
      </section>

      <section aria-labelledby="topups-heading">
        <h2 id="topups-heading" className="heading-section">
          Top-ups
        </h2>
        <p className="mt-1 text-sm text-ink-3">{data.paid ? "One-time. Credits last 12 months." : "Top-ups add to a monthly package. Choose a package first."}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {data.topups.map((t) => (
            <div key={t.key} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
              <span className="text-lg font-semibold tabular-nums text-ink">{formatNumber(t.credits)} credits</span>
              <span className="text-sm text-ink-3">{formatUsd(t.priceUsd)} once</span>
              <Button size="sm" variant="secondary" disabled={!canBuy || !t.available} loading={busy === t.key} onClick={() => onCheckout(t.key as ProductKey)}>
                Buy
              </Button>
            </div>
          ))}
        </div>
      </section>

      {data.orders.length ? (
        <section aria-labelledby="orders-heading">
          <h2 id="orders-heading" className="heading-section">
            Payments
          </h2>
          <DataTable
            className="mt-3"
            caption="Payments"
            rows={data.orders}
            rowKey={(o) => o.id}
            columns={[
              { key: "date", header: "Date", cell: (o) => dateOnly(o.createdAt) },
              { key: "product", header: "For", cell: (o) => data.packages.find((p) => p.key === o.productKey)?.name ?? (o.productKey.startsWith("credits_") ? "Top-up" : o.productKey) },
              { key: "amount", header: "Amount", align: "right", cell: (o) => minorToDisplay(o.amountMinor, o.currency) },
              { key: "status", header: "Status", cell: (o) => ORDER_STATUS[o.status] ?? o.status },
            ]}
          />
        </section>
      ) : null}
    </>
  );
}
