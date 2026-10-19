"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { useState, type FormEvent } from "react";
import { Button, Callout, Field, Input, RadioCards, Switch, toast } from "@/components/ui";
import { errorInfo } from "../errors";
import { LoadingBlock } from "../results/QueryBoundary";
import { PushSettings } from "./PushSettings";
import { SettingsHeader } from "./SettingsNav";

type Prefs = FunctionReturnType<typeof api.settings.preferences>;
type Digest = "daily" | "weekly" | "off";

export function ProfileSettings({ slug: _slug }: { slug: string }) {
  const prefs = useQuery(api.settings.preferences, {});
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader title="Profile" intro="Applies to all your workspaces" />
      {prefs === undefined ? <LoadingBlock label="Loading your profile…" /> : <ProfileForm key={`${prefs.name}-${prefs.digest}-${prefs.usageAlerts}`} prefs={prefs} />}
    </div>
  );
}

function ProfileForm({ prefs }: { prefs: Prefs }) {
  const update = useMutation(api.settings.updatePreferences);
  const [name, setName] = useState(prefs.name ?? "");
  const [digest, setDigest] = useState<Digest>(prefs.digest as Digest);
  const [alerts, setAlerts] = useState(prefs.usageAlerts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = name !== (prefs.name ?? "") || digest !== prefs.digest || alerts !== prefs.usageAlerts;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await update({ digest, usageAlerts: alerts, name });
      toast({ tone: "success", title: "Profile saved" });
    } catch (err) {
      setError(errorInfo(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section aria-labelledby="you-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <h2 id="you-heading" className="heading-section">
          About you
        </h2>
        <Field label="Your name" optional>
          <Input autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-1">
          <p className="text-ui font-medium text-ink">Email</p>
          <p className="text-sm text-ink-2">{prefs.email ?? "No email on this account"}</p>
        </div>
      </section>

      <PushSettings />
      <section aria-labelledby="email-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <h2 id="email-heading" className="heading-section">
          Emails from ClimbOS
        </h2>
        <div className="flex flex-col gap-2">
          <p id="digest-label" className="text-ui font-medium text-ink">
            Progress summary
          </p>
          <RadioCards
            aria-labelledby="digest-label"
            columns={3}
            value={digest}
            onValueChange={(v) => setDigest(v as Digest)}
            options={[
              { value: "daily", title: "Daily", description: "Each morning" },
              { value: "weekly", title: "Weekly", description: "Mondays" },
              { value: "off", title: "Off", description: "Approvals still arrive" },
            ]}
          />
        </div>
        <Switch
          label="Usage alerts"
          description="At 70%, 90% and 100% of monthly credits"
          checked={alerts}
          onCheckedChange={setAlerts}
        />
      </section>

      <div aria-live="polite">
        {error ? (
          <Callout tone="danger" live="none" title="Profile not saved">
            {error}
          </Callout>
        ) : null}
      </div>
      <div>
        <Button type="submit" loading={busy} loadingText="Saving…" disabled={!dirty}>
          Save
        </Button>
      </div>
    </form>
  );
}
