"use client";

/*
 * Payments: PaymentMethodCard / PaymentMethods, InvoiceHistory, CouponInput,
 * PaymentConfirmation and CancellationFlow. Card numbers never appear in
 * full: brand + last 4 only.
 */
import { useState } from "react";
import { CircleAlert, CircleCheck, CreditCard, Download, Gift, Plus, Tag, X } from "@/components/icons";
import { Badge, Button, Dialog, DialogContent, DialogFooter, Input, RadioCards, Spinner, toast, type Tone } from "@/components/ui";
import { cn, formatUsd } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Payment methods                                                     */
/* ------------------------------------------------------------------ */

export interface PaymentMethod {
  id: string;
  brand: "Visa" | "Mastercard" | "Amex";
  last4: string;
  exp: string;
  isDefault?: boolean;
  expiringSoon?: boolean;
}

/** One saved card: brand, last 4, expiry, default and expiry warnings. */
export function PaymentMethodCard({ method, onMakeDefault, onRemove }: { method: PaymentMethod; onMakeDefault?: () => void; onRemove?: () => void }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border bg-surface px-4 py-3", method.isDefault ? "border-ink/40" : "border-line")}>
      <span aria-hidden className="grid h-8 w-12 place-items-center rounded-[3px] bg-ink text-2xs font-semibold uppercase tracking-wide text-white">
        {method.brand === "Mastercard" ? "MC" : method.brand}
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex flex-wrap items-center gap-1.5 text-ui font-medium text-ink">
          {method.brand} ending {method.last4}
          {method.isDefault ? <Badge>Default</Badge> : null}
          {method.expiringSoon ? <Badge tone="amber">Expires soon</Badge> : null}
        </p>
        <p className="text-xs text-ink-3">Expires {method.exp}</p>
      </div>
      <div className="flex gap-1">
        {!method.isDefault && onMakeDefault ? (
          <Button size="sm" variant="ghost" onClick={onMakeDefault}>
            Make default
          </Button>
        ) : null}
        <Button size="sm" variant="secondary">
          Update
        </Button>
        {!method.isDefault && onRemove ? (
          <Button size="sm" variant="ghost" aria-label={`Remove ${method.brand} ending ${method.last4}`} onClick={onRemove}>
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Saved cards with default switching and an add row. */
export function PaymentMethods({ methods, onChange }: { methods: PaymentMethod[]; onChange: (m: PaymentMethod[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {methods.map((m) => (
        <PaymentMethodCard
          key={m.id}
          method={m}
          onMakeDefault={() => onChange(methods.map((x) => ({ ...x, isDefault: x.id === m.id })))}
          onRemove={() => onChange(methods.filter((x) => x.id !== m.id))}
        />
      ))}
      <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong text-ui font-medium text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
        <Plus aria-hidden className="size-4" /> Add payment method
      </button>
      <p className="flex items-center gap-1.5 text-xs text-ink-3">
        <CreditCard aria-hidden className="size-3.5" /> Cards are stored by our payment provider. ClimbOS only sees the last 4 digits.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "refunded" | "failed" | "open";
}

const INV: Record<Invoice["status"], { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "green" },
  refunded: { label: "Refunded", tone: "neutral" },
  failed: { label: "Failed", tone: "red" },
  open: { label: "Due", tone: "amber" },
};

/** Invoices and top-up receipts, newest first, with PDF download. Paged by 5. */
export function InvoiceHistory({ invoices }: { invoices: Invoice[] }) {
  const [page, setPage] = useState(0);
  const per = 5;
  const pages = Math.ceil(invoices.length / per);
  const rows = invoices.slice(page * per, page * per + per);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[560px] text-ui">
          <caption className="sr-only">Invoice history</caption>
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th scope="col" className="h-[var(--cell-h)] px-4 font-medium">Date</th>
              <th scope="col" className="px-3 font-medium">Description</th>
              <th scope="col" className="px-3 text-right font-medium">Amount</th>
              <th scope="col" className="px-3 font-medium">Status</th>
              <th scope="col" className="px-3"><span className="sr-only">Download</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className="border-t border-line first:border-t-0">
                <td className="h-[var(--cell-h)] whitespace-nowrap px-4 tabular-nums text-ink-2">{i.date}</td>
                <td className="px-3 text-ink">
                  {i.description}
                  <span className="block text-xs text-ink-3">{i.id}</span>
                </td>
                <td className={cn("px-3 text-right tabular-nums", i.status === "refunded" && "text-ink-3 line-through")}>{formatUsd(i.amount, { cents: true })}</td>
                <td className="px-3">
                  <Badge tone={INV[i.status].tone}>{INV[i.status].label}</Badge>
                </td>
                <td className="px-3 text-right">
                  {i.status === "failed" || i.status === "open" ? (
                    <Button size="sm" variant="secondary">
                      Pay now
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" aria-label={`Download ${i.id} PDF`} onClick={() => toast({ title: `${i.id}.pdf downloaded`, tone: "success" })}>
                      <Download /> PDF
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav aria-label="Invoice pages" className="flex items-center justify-between text-xs text-ink-3">
          <span>
            Page {page + 1} of {pages}
          </span>
          <span className="flex gap-1">
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </span>
        </nav>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coupon                                                              */
/* ------------------------------------------------------------------ */

export interface Coupon {
  code: string;
  /** Plain description of the discount. */
  label: string;
}

/** Code field with apply / applied / invalid states. `validate` returns the coupon or null. */
export function CouponInput({ validate, onApplied }: { validate: (code: string) => Coupon | null; onApplied?: (c: Coupon | null) => void }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "bad">("idle");
  const [applied, setApplied] = useState<Coupon | null>(null);
  if (applied) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-green-500/40 bg-green-100/50 px-3 py-2 text-ui">
        <Tag aria-hidden className="size-4 text-green-800" />
        <span className="font-mono font-semibold text-green-800">{applied.code}</span>
        <span className="min-w-0 flex-1 text-ink-2">{applied.label}</span>
        <button
          type="button"
          onClick={() => {
            setApplied(null);
            onApplied?.(null);
          }}
          className="text-xs font-medium text-ink-3 underline hover:text-ink"
        >
          Remove
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setState("checking");
        window.setTimeout(() => {
          const c = validate(code.trim().toUpperCase());
          if (c) {
            setApplied(c);
            setState("idle");
            setCode("");
            onApplied?.(c);
          } else setState("bad");
        }, 600);
      }}
    >
      <label htmlFor="coupon" className="text-ui font-medium">
        Promo code
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (state === "bad") setState("idle");
          }}
          placeholder="AUTUMN20"
          aria-invalid={state === "bad" || undefined}
          aria-describedby={state === "bad" ? "coupon-err" : undefined}
          className="max-w-56 font-mono uppercase"
        />
        <Button type="submit" variant="secondary" loading={state === "checking"} disabled={!code.trim()}>
          Apply
        </Button>
      </div>
      {state === "bad" ? (
        <p id="coupon-err" role="alert" className="flex items-center gap-1.5 text-ui font-medium text-red-800">
          <CircleAlert aria-hidden className="size-4" /> That code isn’t valid or has expired.
        </p>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Payment confirmation                                                */
/* ------------------------------------------------------------------ */

export interface PaymentConfirmationProps {
  state: "processing" | "succeeded" | "failed";
  amount: number;
  /** What was bought, e.g. "1,800 credits top-up". */
  item: string;
  method: string;
  receipt?: string;
  onRetry?: () => void;
  onDone?: () => void;
}

/** After paying: processing, receipt, or a clear failure with retry. Announced politely. */
export function PaymentConfirmation({ state, amount, item, method, receipt, onRetry, onDone }: PaymentConfirmationProps) {
  return (
    <section role="status" aria-live="polite" className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center shadow-[var(--card-shadow)]">
      {state === "processing" ? (
        <>
          <Spinner className="text-kpi text-ink-3" />
          <p className="heading-card">Processing payment…</p>
          <p className="text-ui text-ink-3">Don’t close this window. It takes a few seconds.</p>
        </>
      ) : state === "succeeded" ? (
        <>
          <span className="grid size-12 place-items-center rounded-full bg-lime">
            <CircleCheck aria-hidden className="size-6 text-ink" />
          </span>
          <p className="heading-dialog">Payment received</p>
          <p className="text-sm text-ink-2">
            {formatUsd(amount, { cents: true })} · {item}
          </p>
          <dl className="grid w-full max-w-xs grid-cols-2 gap-y-1 border-t border-line pt-3 text-left text-xs">
            <dt className="text-ink-3">Paid with</dt>
            <dd className="text-right text-ink">{method}</dd>
            {receipt ? (
              <>
                <dt className="text-ink-3">Receipt</dt>
                <dd className="text-right font-mono text-ink">{receipt}</dd>
              </>
            ) : null}
          </dl>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary">
              <Download /> Receipt
            </Button>
            {onDone ? (
              <Button size="sm" onClick={onDone}>
                Done
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <span className="grid size-12 place-items-center rounded-full bg-red-100">
            <CircleAlert aria-hidden className="size-6 text-red-800" />
          </span>
          <p className="heading-dialog">Payment didn’t go through</p>
          <p className="max-w-sm text-ui text-ink-2">Your bank declined {method}. Nothing was charged. Try again or use another card.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
            <Button size="sm" variant="secondary">
              Use another card
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cancellation                                                        */
/* ------------------------------------------------------------------ */

const REASONS = [
  { value: "price", title: "Too expensive" },
  { value: "results", title: "Not seeing results yet" },
  { value: "time", title: "No time to review posts" },
  { value: "seasonal", title: "Seasonal business, quiet months" },
  { value: "other", title: "Something else" },
];

/** Three steps: why → an honest alternative (pause or downgrade) → confirm with the end date. */
export function CancellationFlow({ endsOn, plan, onCancelled, onPaused }: { endsOn: string; plan: string; onCancelled: () => void; onPaused: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => {
    setOpen(false);
    setStep(0);
    setReason("");
  };
  const offer =
    reason === "seasonal" || reason === "time"
      ? { title: "Pause instead", body: "Pause for up to 3 months. Nothing runs and nothing is charged. Your plays and history stay.", cta: "Pause for 1 month", Icon: Gift }
      : { title: "Switch to Starter", body: "1,100 credits a month for $15. Keeps weekly posts running.", cta: "Switch to Starter", Icon: Tag };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <Button variant="ghost" className="text-red-800" onClick={() => setOpen(true)}>
        Cancel plan
      </Button>
      <DialogContent title={step === 0 ? "Why are you leaving?" : step === 1 ? "Before you go" : `Cancel ${plan}?`} description={`Step ${step + 1} of 3`}>
        <ol aria-label="Progress" className="mb-4 flex gap-1">
          {[0, 1, 2].map((i) => (
            <li key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-ink" : "bg-surface-3")}>
              <span className="sr-only">{i < step ? "Done" : i === step ? "Current" : "Next"}</span>
            </li>
          ))}
        </ol>
        {step === 0 ? (
          <RadioCards aria-label="Reason" columns={1} value={reason} onValueChange={setReason} options={REASONS} className="gap-2" />
        ) : step === 1 ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface-2 p-4">
            <p className="flex items-center gap-2 heading-card">
              <offer.Icon aria-hidden className="size-4" /> {offer.title}
            </p>
            <p className="text-ui text-ink-2">{offer.body}</p>
            <Button
              size="sm"
              className="self-start"
              onClick={() => {
                onPaused();
                close();
              }}
            >
              {offer.cta}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2 text-ui text-ink-2">
            <li>• {plan} stays active until <strong className="text-ink">{endsOn}</strong>.</li>
            <li>• Unused plan credits expire then. Top-up credits stay on the account.</li>
            <li>• Scheduled posts after {endsOn} won’t publish.</li>
            <li>• You can come back any time; your data is kept for 90 days.</li>
          </ul>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={step === 0 ? close : () => setStep(step - 1)}>
            {step === 0 ? `Keep ${plan}` : "Back"}
          </Button>
          {step < 2 ? (
            <Button variant={step === 1 ? "ghost" : "primary"} disabled={step === 0 && !reason} onClick={() => setStep(step + 1)}>
              {step === 1 ? "No thanks, continue" : "Continue"}
            </Button>
          ) : (
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                setBusy(true);
                window.setTimeout(() => {
                  setBusy(false);
                  onCancelled();
                  close();
                }, 800);
              }}
            >
              Cancel on {endsOn}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
