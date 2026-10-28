"use client";

import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Callout, Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger, Field, Input, toast } from "@/components/ui";
import { Scannable } from "@/components/ds/content";
import { errorMessage } from "../errors";

export function WordPressConnectDialog({ slug, trigger }: { slug: string; trigger: ReactNode }) {
  const connect = useAction(api.connectionActions.connectWordPress);
  const [open, setOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await connect({ slug, siteUrl, username, applicationPassword });
      if (!result.ok) { setError(result.message); return; }
      toast({ tone: "success", title: "WordPress access verified", description: "Application Password stored encrypted." });
      setSiteUrl(""); setUsername(""); setApplicationPassword(""); setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (busy) return;
      setOpen(next);
      if (!next) { setSiteUrl(""); setUsername(""); setApplicationPassword(""); setError(null); }
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Connect WordPress">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Scannable text={[
            "In WordPress, open Users → Profile → Application Passwords.",
            "Create one named ClimbOS and copy it.",
            "Paste your site address, username and that password below.",
          ].map((step, index) => `${index + 1}. ${step}`).join("\n")} shape="steps" max={3} tone="muted" />
          <Field label="WordPress site" hint="Public HTTPS address" error={error ?? undefined}>
            <Input type="url" autoComplete="url" placeholder="https://example.com" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} required />
          </Field>
          <Field label="WordPress username">
            <Input autoComplete="username" autoCapitalize="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
          <Field label="Application Password" hint="Not your regular WordPress password.">
            <Input type="password" autoComplete="new-password" autoCapitalize="off" spellCheck={false} value={applicationPassword} onChange={(e) => setApplicationPassword(e.target.value)} required />
          </Field>
          <Callout tone="info">Stored encrypted, never shown again; revoke it any time in WordPress. We only create private drafts from approved articles, after you confirm. We never publish to your site.</Callout>
          <p aria-live="assertive" className="sr-only">{error ?? ""}</p>
          <DialogFooter className="mt-2">
            <DialogClose asChild><Button variant="secondary" disabled={busy}>Cancel</Button></DialogClose>
            <Button type="submit" loading={busy} loadingText="Checking access…">Verify and connect</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
