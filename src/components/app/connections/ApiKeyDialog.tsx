"use client";

import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Callout, Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger, Field, Input, toast } from "@/components/ui";
import { Scannable } from "@/components/ds/content";
import { errorMessage } from "../errors";

type KeyProvider = "email_resend" | "stripe_revenue";

const COPY: Record<KeyProvider, { title: string; label: string; hint: string; placeholder: string; steps: string[] }> = {
  stripe_revenue: {
    title: "Connect Stripe (read-only)",
    label: "Stripe restricted key",
    hint: "Starts with rk_. Never sk_.",
    placeholder: "rk_live_…",
    steps: ["Stripe → Developers → API keys → Create restricted key.", "Read: Charges, Invoices, Refunds. All else: None."],
  },
  email_resend: {
    title: "Connect your Resend account",
    label: "Resend API key",
    hint: "Starts with re_.",
    placeholder: "re_…",
    steps: ["Resend → API Keys → Create API key.", "Full access (contacts, segments, broadcasts)."],
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
        toast({ tone: "success", title: provider === "stripe_revenue" ? "Stripe connected" : "Resend connected" });
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
      <DialogContent title={copy.title}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Scannable text={copy.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")} shape="steps" max={copy.steps.length} tone="muted" />
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
            Checked, stored encrypted, never shown again.
          </Callout>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="secondary" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy} loadingText="Checking…">
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
