"use client";

import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Callout, Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger, Field, Input, toast } from "@/components/ui";
import { errorMessage } from "../errors";

type KeyProvider = "email_resend" | "stripe_revenue";

const COPY: Record<KeyProvider, { title: string; label: string; hint: string; placeholder: string; steps: ReactNode }> = {
  stripe_revenue: {
    title: "Connect Stripe (read-only)",
    label: "Stripe restricted key",
    hint: "Starts with rk_. Never paste your secret key (sk_).",
    placeholder: "rk_live_…",
    steps: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>In Stripe, open Developers → API keys → Create restricted key.</li>
        <li>Give it Read access to Charges, Invoices and Refunds only. Leave everything else as None.</li>
        <li>Copy the key (it starts with rk_) and paste it below.</li>
      </ol>
    ),
  },
  email_resend: {
    title: "Connect your Resend account",
    label: "Resend API key",
    hint: "Starts with re_. Use a key from your own Resend account.",
    placeholder: "re_…",
    steps: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>In your Resend account, open API Keys → Create API key.</li>
        <li>ClimbOS needs full access so it can manage your contacts, segments and broadcasts. Emails are sent from your account and your domain.</li>
        <li>Copy the key (it starts with re_) and paste it below.</li>
      </ol>
    ),
  },
};

/** Connect an API-key provider. The key is checked with the provider before it's stored. */
export function ApiKeyDialog({ slug, provider, trigger }: { slug: string; provider: KeyProvider; trigger: ReactNode }) {
  const connect = useAction(api.connectionActions.connectApiKey);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[provider];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) {
      setError("Paste the key first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await connect({ slug, provider, apiKey: key });
      if (res.ok) {
        toast({ tone: "success", title: provider === "stripe_revenue" ? "Stripe connected" : "Resend connected", description: "The provider accepted the key." });
        setKey("");
        setOpen(false);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (!v) {
          setKey("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={copy.title} description="Least privilege: give ClimbOS only the access it needs.">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="text-[0.95rem] leading-relaxed text-ink-2">{copy.steps}</div>
          <Field label={copy.label} hint={copy.hint} error={error ?? undefined}>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              placeholder={copy.placeholder}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>
          <p aria-live="assertive" className="sr-only">
            {error ?? ""}
          </p>
          <Callout tone="info">
            We check the key with the provider, then store it encrypted. It&apos;s never shown again — not to you, your team or ClimbOS staff. You can disconnect at
            any time.
          </Callout>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="secondary" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy} loadingText="Checking key…">
              Check and connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
