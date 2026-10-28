"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ShieldCheck } from "@/components/icons";
import { Button, Callout, ConfirmDialog, Field, Input, RadioCards, Switch, buttonClasses, toast } from "@/components/ui";
import { errorInfo } from "../errors";
import { relativeTime } from "../money";
import { LoadingBlock } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";
import { ContactFrequencySetting } from "./ContactFrequencySetting";

type Policies = FunctionReturnType<typeof api.settings.policies>;
type Policy = NonNullable<Policies["policy"]>;
type Mode = "copilot" | "review" | "bounded_autopilot";

const MODES: { value: Mode; title: string; description: string }[] = [
  { value: "copilot", title: "Copilot", description: "We draft. You post and launch." },
  { value: "review", title: "Review first", description: "Nothing goes live until approved." },
  { value: "bounded_autopilot", title: "Bounded Autopilot", description: "Pre-approved work runs within your limits." },
];

const ALWAYS_APPROVE = [
  "First post on a channel",
  "New ads or campaigns",
  "New audiences",
  "Ad budget increases",
  "Discounts or offers",
  "Website changes",
];

export function PoliciesSettings({ slug }: { slug: string }) {
  const data = useQuery(api.settings.policies, { slug });
  return (
    <div className="flex flex-col gap-8">
      <SettingsHeader title="Policies" />
      {data === undefined ? (
        <LoadingBlock label="Loading approval rules…" />
      ) : (
        <>
          {data.emergencyStop ? (
            <Callout tone="warning" title="Pause all is on">
              Since {relativeTime(data.emergencyStop.at)}. Nothing runs until an owner or admin resumes it.
            </Callout>
          ) : null}
          {!data.canManage ? (
            <Callout tone="info" title="View only">
              Owners and admins can edit.
            </Callout>
          ) : null}
          {data.policy ? (
            <PolicyForm key={data.policy.version} slug={slug} policy={data.policy} allowedModes={[...data.allowedModes]} canManage={data.canManage} />
          ) : (
            <Callout tone="info" title="No rules yet">
              Created when setup finishes. <Link href="/onboarding">Continue setup</Link>
            </Callout>
          )}
          <ContactFrequencySetting slug={slug} days={data.contactFrequencyDays} canManage={data.canManage} />
          <section aria-labelledby="always-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <h2 id="always-heading" className="heading-section flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-4 text-brand-800" /> Always needs your approval
            </h2>
            <ul className="grid gap-2 text-sm text-ink-2 sm:grid-cols-2 lg:grid-cols-3">
              {ALWAYS_APPROVE.map((a) => (
                <li key={a} className="rounded-lg bg-surface-2 px-3 py-2">
                  {a}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function PolicyForm({ slug, policy, allowedModes, canManage }: { slug: string; policy: Policy; allowedModes: string[]; canManage: boolean }) {
  const update = useMutation(api.settings.updatePolicy);
  const [mode, setMode] = useState<Mode>(policy.mode as Mode);
  const [adPause, setAdPause] = useState(policy.allowAdPauseRules);
  const [budget, setBudget] = useState(String(policy.maxMonthlyAdSpend));
  const [ttl, setTtl] = useState(String(policy.approvalTtlHours));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ budget?: string; ttl?: string }>({});

  const dirty =
    mode !== policy.mode ||
    adPause !== policy.allowAdPauseRules ||
    Number(budget) !== policy.maxMonthlyAdSpend ||
    Number(ttl) !== policy.approvalTtlHours;

  const voidsApprovals = mode !== policy.mode || adPause !== policy.allowAdPauseRules || Number(budget) !== policy.maxMonthlyAdSpend;

  function validate(): boolean {
    const fe: { budget?: string; ttl?: string } = {};
    const b = Number(budget);
    const t = Number(ttl);
    if (budget.trim() === "" || !Number.isFinite(b) || b < 0 || b > 1_000_000) fe.budget = "Enter an amount between 0 and 1,000,000.";
    if (ttl.trim() === "" || !Number.isFinite(t) || t < 1 || t > 336) fe.ttl = "Enter between 1 and 336 hours (14 days).";
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    // Only rule changes cancel approvals; a new expiry window applies to new approvals and saves directly.
    if (voidsApprovals) setConfirm(true);
    else void save();
  }

  async function save() {
    try {
      const res = await update({
        slug,
        mode,
        allowAdPauseRules: adPause,
        maxMonthlyAdSpend: Number(budget),
        approvalTtlHours: Math.round(Number(ttl)),
      });
      toast({ tone: "success", title: "Rules saved", description: res?.invalidated ? "Earlier approvals cancelled." : undefined });
    } catch (err) {
      const info = errorInfo(err);
      setError(info.code === "PAYMENT_REQUIRED" ? `${info.message}` : info.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <fieldset disabled={!canManage} className="flex flex-col gap-6 disabled:opacity-80">
        <section aria-labelledby="mode-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="mode-heading" className="heading-section">
              Mode
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">Version {policy.version}</p>
          </div>
          <RadioCards
            aria-labelledby="mode-heading"
            columns={3}
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            disabled={!canManage}
            options={MODES.map((m) => {
              const allowed = allowedModes.includes(m.value);
              return {
                value: m.value,
                title: m.title,
                description: allowed ? m.description : `${m.description} Needs a higher plan.`,
                disabled: !allowed,
              };
            })}
          />
          {allowedModes.length < MODES.length ? (
            <p className="text-sm text-ink-3">
              <Link className={buttonClasses({ variant: "link" })} href={`/app/${slug}/settings/billing`}>See plans</Link>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="limits-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <h2 id="limits-heading" className="heading-section">
            Limits
          </h2>
          <Switch
            label="Auto-pause ads that break your rules"
            description="Only ever reduces spend."
            checked={adPause}
            onCheckedChange={setAdPause}
            disabled={!canManage}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Maximum monthly ad spend (${policy.currency})`} hint="Hard cap." error={fieldErrors.budget}>
              <Input type="number" inputMode="decimal" min="0" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </Field>
            <Field label="Approvals expire after (hours)" error={fieldErrors.ttl}>
              <Input type="number" inputMode="numeric" min="1" max="336" step="1" value={ttl} onChange={(e) => setTtl(e.target.value)} />
            </Field>
          </div>
        </section>
      </fieldset>

      <div aria-live="polite">
        {error ? (
          <Callout tone="danger" live="none" title="Rules not saved">
            {error}
          </Callout>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty}>
            Save
          </Button>
          {!dirty ? <span className="text-sm text-ink-3">No changes</span> : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Save new rules?"
        description="Cancels all current approvals. Anything not yet live needs approving again."
        confirmLabel="Save and cancel approvals"
        onConfirm={save}
      />
    </form>
  );
}
