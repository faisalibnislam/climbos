"use client";

import { useState } from "react";
import { Button, Segmented, toast } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import {
  BillingCycleSelector,
  CurrentPlanCard,
  PlanComparisonTable,
  RenewalDate,
  SubscriptionStatus,
  TrialCountdown,
  UpgradeButton,
  UpgradeWithConfirm,
  planOf,
  type Cycle,
  type PlanId,
  type SubStatus,
} from "@/components/ds/billing/plan";
import { CancellationFlow, CouponInput, InvoiceHistory, PaymentConfirmation, PaymentMethods, type Invoice, type PaymentMethod } from "@/components/ds/billing/payment";
import { AddOnSelector, CreditBalance, OverageIndicator, QuotaBar, SeatManagement, UsageMeter } from "@/components/ds/billing/usage";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

const METHODS: PaymentMethod[] = [
  { id: "pm1", brand: "Visa", last4: "4242", exp: "08/28", isDefault: true },
  { id: "pm2", brand: "Mastercard", last4: "4444", exp: "11/26", expiringSoon: true },
];

const INVOICES: Invoice[] = [
  { id: "INV-2026-0142", date: "1 Oct 2026", description: "Pro plan · October", amount: 39, status: "paid" },
  { id: "INV-2026-0139", date: "24 Sep 2026", description: "Top-up · 1,800 credits", amount: 25, status: "paid" },
  { id: "INV-2026-0121", date: "1 Sep 2026", description: "Pro plan · September", amount: 39, status: "paid" },
  { id: "INV-2026-0117", date: "19 Aug 2026", description: "Top-up · 700 credits", amount: 10, status: "refunded" },
  { id: "INV-2026-0104", date: "1 Aug 2026", description: "Pro plan · August", amount: 39, status: "paid" },
  { id: "INV-2026-0088", date: "1 Jul 2026", description: "Starter plan · July", amount: 15, status: "failed" },
  { id: "INV-2026-0061", date: "1 Jun 2026", description: "Starter plan · June", amount: 15, status: "paid" },
];

const SLICES = [
  { label: "Posts and images", credits: 720 },
  { label: "Lead finder", credits: 480 },
  { label: "Cold email", credits: 360 },
  { label: "Ad drafts", credits: 180 },
  { label: "Insights", credits: 120 },
];

const COUPONS: Record<string, string> = { AUTUMN20: "20% off Pro for 3 months", AGENCY10: "10% off every client workspace" };

export function BillingContent() {
  const [plan, setPlan] = useState<PlanId>("pro");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [sub, setSub] = useState<SubStatus>("past_due");
  const [methods, setMethods] = useState(METHODS);
  const [topUp, setTopUp] = useState(700);
  const [caps, setCaps] = useState([
    { label: "Tartine Bakery", used: 1240, cap: 1500 },
    { label: "Tartine Catering", used: 140, cap: 500 },
    { label: "Ollie’s Gym (client)", used: 480, cap: 500 },
  ]);
  const [pay, setPay] = useState<"processing" | "succeeded" | "failed">("succeeded");
  const [paid, setPaid] = useState({ amount: 25, credits: 1800 });
  const [cancelled, setCancelled] = useState(false);
  const p = planOf(plan);

  return (
    <DocPage eyebrow="Components" title="Billing" intro="Credits are the currency: one shared balance per account, capped per workspace. Plans add credits monthly; top-ups never expire.">
      <Specimen title="Current plan card">
        <Stage className="max-w-xl">
          <CurrentPlanCard plan={plan} cycle={cycle} renews="1 Nov" creditsLeft={plan === "pro" ? 1140 : Math.min(1140, p.credits)} onChangePlan={() => document.getElementById("plan-comparison-table")?.scrollIntoView()} />
        </Stage>
      </Specimen>

      <Specimen title="Plan comparison table" description="Recommended plan gets the lime CTA. Switch the cycle in the selector below.">
        <PlanComparisonTable
          current={plan}
          cycle={cycle}
          onSelect={(id) => {
            setPlan(id);
            toast({ title: `Switched to ${planOf(id).name}`, tone: "success" });
          }}
        />
        <Spec items={[["Prices", "Starter $15 / 1,100 credits, Pro $39 / 3,000 credits, Free 50 credits once"], ["Yearly", "10× monthly (2 months free)"]]} />
      </Specimen>

      <Specimen title="Upgrade button" description="Lime, once per screen. The confirm states the prorated charge.">
        <Stage tone="white" className="flex flex-wrap items-center gap-4">
          <UpgradeWithConfirm from="starter" to="pro" daysLeft={13} onDone={() => toast({ title: "You’re on Pro", description: "1,900 more credits added.", tone: "success" })} />
          <UpgradeButton size="pill" />
          <UpgradeButton to="Pro" loading />
        </Stage>
      </Specimen>

      <Specimen title="Subscription status">
        <Stage className="flex flex-col gap-3">
          <Segmented
            label="Status"
            value={sub}
            onChange={setSub}
            options={[
              { value: "active", label: "Active" },
              { value: "trialing", label: "Trial" },
              { value: "past_due", label: "Past due" },
              { value: "paused", label: "Paused" },
              { value: "canceled", label: "Cancelling" },
            ]}
          />
          <SubscriptionStatus status={sub} onAction={() => setSub("active")} />
        </Stage>
      </Specimen>

      <Specimen title="Billing cycle selector">
        <Stage tone="white">
          <BillingCycleSelector value={cycle} onChange={setCycle} />
        </Stage>
      </Specimen>

      <Specimen title="Payment method card" description="Brand and last 4 only.">
        <Stage className="max-w-xl">
          <PaymentMethods methods={methods} onChange={setMethods} />
        </Stage>
      </Specimen>

      <Specimen title="Invoice history">
        <InvoiceHistory invoices={INVOICES} />
      </Specimen>

      <Specimen title="Usage meter" description="Credits by feature. The tick marks today; the line under it says where you’ll land.">
        <Stage className="max-w-2xl">
          <UsageMeter slices={SLICES} limit={3000} day={18} days={30} />
        </Stage>
      </Specimen>

      <Specimen title="Credit balance">
        <Stage className="max-w-md">
          <CreditBalance plan={1140} topUp={topUp} resetsOn="1 Nov" onTopUp={() => document.getElementById("add-on-selector")?.scrollIntoView()} />
        </Stage>
      </Specimen>

      <Specimen title="Quota progress bar" description="Per-workspace caps on the shared balance. Pencil edits the cap.">
        <Stage tone="white" className="flex max-w-xl flex-col gap-4">
          {caps.map((c, i) => (
            <QuotaBar key={c.label} label={c.label} used={c.used} cap={c.cap} onCapChange={(cap) => setCaps(caps.map((x, j) => (j === i ? { ...x, cap } : x)))} />
          ))}
        </Stage>
        <Spec items={[["States", "Ink < 80%, amber 80–99%, red at cap (badge text too)"]]} />
      </Specimen>

      <Specimen title="Overage indicator">
        <Stage className="flex max-w-2xl flex-col gap-3">
          <OverageIndicator kind="near" scope="Ollie’s Gym" amount={96} onRaise={() => undefined} onTopUp={() => undefined} />
          <OverageIndicator kind="over" scope="Tartine Bakery" amount={320} onRaise={() => undefined} onTopUp={() => undefined} />
          <OverageIndicator kind="topup" scope="Account" amount={topUp} />
        </Stage>
      </Specimen>

      <Specimen title="Trial countdown" description="Days, then a live clock. Turns red in the last 3 days.">
        <Stage className="grid gap-3 md:grid-cols-2">
          <TrialCountdown secondsLeft={9 * 86400 + 4 * 3600 + 12 * 60} onUpgrade={() => undefined} />
          <TrialCountdown secondsLeft={1 * 86400 + 3 * 3600 + 5 * 60 + 30} />
        </Stage>
      </Specimen>

      <Specimen title="Renewal date">
        <Stage className="max-w-xl">
          <RenewalDate date="1 Nov 2026" amount={39} />
        </Stage>
      </Specimen>

      <Specimen title="Cancellation flow" description="Why, an honest alternative, then the exact end date.">
        <Stage tone="white" className="flex flex-wrap items-center gap-3">
          {cancelled ? (
            <>
              <SubscriptionStatus status="canceled" compact />
              <Button size="sm" variant="secondary" onClick={() => setCancelled(false)}>
                Keep my plan
              </Button>
            </>
          ) : (
            <CancellationFlow plan="Pro" endsOn="1 Nov" onCancelled={() => setCancelled(true)} onPaused={() => toast({ title: "Plan paused until 19 Nov", tone: "success" })} />
          )}
        </Stage>
      </Specimen>

      <Specimen title="Add-on selector" description="Top-up packs. Arrow keys move between packs.">
        <Stage className="max-w-2xl">
          <AddOnSelector
            onBuy={(pack, auto) => {
              setPaid({ amount: pack.price, credits: pack.credits });
              setPay("processing");
              document.getElementById("payment-confirmation")?.scrollIntoView();
              window.setTimeout(() => {
                setPay("succeeded");
                setTopUp((t) => t + pack.credits);
                if (auto) toast({ title: "Auto top-up on", tone: "success" });
              }, 1500);
            }}
          />
        </Stage>
      </Specimen>

      <Specimen title="Seat management">
        <Stage className="max-w-xl">
          <SeatManagement included={10} used={8} seatPrice={6} />
        </Stage>
      </Specimen>

      <Specimen title="Coupon input" description="Try AUTUMN20.">
        <Stage tone="white" className="max-w-md">
          <CouponInput validate={(c) => (COUPONS[c] ? { code: c, label: COUPONS[c] } : null)} />
        </Stage>
      </Specimen>

      <Specimen title="Payment confirmation" description="Buying a top-up above runs this live.">
        <Stage className="flex flex-col gap-3">
          <Segmented
            label="Payment state"
            value={pay}
            onChange={setPay}
            options={[
              { value: "processing", label: "Processing" },
              { value: "succeeded", label: "Succeeded" },
              { value: "failed", label: "Failed" },
            ]}
          />
          <div className="max-w-md">
            <PaymentConfirmation state={pay} amount={paid.amount} item={`${formatNumber(paid.credits)} credits top-up`} method="Visa ending 4242" receipt="RCPT-7Q2M-1048" onRetry={() => setPay("succeeded")} />
          </div>
        </Stage>
      </Specimen>
    </DocPage>
  );
}
