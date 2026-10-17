"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Callout, ConfirmDialog, Field, Input, RadioCards, Switch, buttonClasses, toast } from "@/components/ui";
import { errorInfo } from "../errors";
import { relativeTime } from "../money";
import { LoadingBlock } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";

type Policies = FunctionReturnType<typeof api.settings.policies>;
type Policy = NonNullable<Policies["policy"]>;
type Mode = "copilot" | "review" | "bounded_autopilot";

const MODES: { value: Mode; title: string; description: string }[] = [
  { value: "copilot", title: "Copilot", description: "ClimbOS drafts plans, posts and ads. You copy, post and launch everything yourself." },
  { value: "review", title: "Review before execution", description: "ClimbOS prepares the work. Nothing goes live until someone with approval rights approves it." },
  {
    value: "bounded_autopilot",
    title: "Bounded Autopilot",
    description: "Only kinds of work you pre-approved run on their own — within your connected accounts, your time window and your spending limit.",
  },
];

const ALWAYS_APPROVE = [
  "The first post on any channel",
  "Any new ad or campaign",
  "Any new audience",
  "Any increase to an ad budget",
  "Any discount or offer",
  "Any change to your website",
];

export function PoliciesSettings({ slug }: { slug: string }) {
  const data = useQuery(api.settings.policies, { slug });
  return (
    <div className="flex flex-col gap-8">
      <SettingsHeader title="Policies" intro="Decide how much ClimbOS may do on its own. These rules are checked by ClimbOS before every action, not just shown here." />
      {data === undefined ? (
        <LoadingBlock label="Loading approval rules…" />
      ) : (
        <>
          {data.emergencyStop ? (
            <Callout tone="warning" title="Pause all is on">
              Everything has been paused since {relativeTime(data.emergencyStop.at)}. Nothing runs, whatever the rules below say, until an owner or admin resumes.
            </Callout>
          ) : null}
          {!data.canManage ? (
            <Callout tone="info" title="View only">
              Only owners and admins can change approval rules.
            </Callout>
          ) : null}
          {data.policy ? (
            <PolicyForm key={data.policy.version} slug={slug} policy={data.policy} allowedModes={[...data.allowedModes]} canManage={data.canManage} />
          ) : (
            <Callout tone="info" title="No rules yet">
              Approval rules are created when you finish setting up your workspace. <Link href="/onboarding">Continue setup</Link>.
            </Callout>
          )}
          <section aria-labelledby="always-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <h2 id="always-heading" className="heading-section">
              Always needs your approval
            </h2>
            <p className="text-ink-2">Whatever mode you choose, these always wait for a person to approve them:</p>
            <ul className="list-disc space-y-1 pl-5 text-ink-2">
              {ALWAYS_APPROVE.map((a) => (
                <li key={a}>{a}</li>
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
  const [recurring, setRecurring] = useState(policy.allowRecurringPostsUnderCalendar);
  const [adPause, setAdPause] = useState(policy.allowAdPauseRules);
  const [budget, setBudget] = useState(String(policy.maxMonthlyAdSpend));
  const [ttl, setTtl] = useState(String(policy.approvalTtlHours));
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ budget?: string; ttl?: string }>({});

  const dirty =
    mode !== policy.mode ||
    recurring !== policy.allowRecurringPostsUnderCalendar ||
    adPause !== policy.allowAdPauseRules ||
    Number(budget) !== policy.maxMonthlyAdSpend ||
    Number(ttl) !== policy.approvalTtlHours;

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
    if (validate()) setConfirm(true);
  }

  async function save() {
    try {
      await update({
        slug,
        mode,
        allowRecurringPostsUnderCalendar: recurring,
        allowAdPauseRules: adPause,
        maxMonthlyAdSpend: Number(budget),
        approvalTtlHours: Math.round(Number(ttl)),
      });
      toast({ tone: "success", title: "Approval rules saved", description: "Earlier approvals were cancelled and need to be approved again." });
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
              How ClimbOS works for you
            </h2>
            <p className="mt-0.5 text-xs text-ink-3">Current rules: version {policy.version}</p>
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
              Some modes need a higher plan. <Link className={buttonClasses({ variant: "link" })} href={`/app/${slug}/settings/billing`}>See plans</Link>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="limits-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <h2 id="limits-heading" className="heading-section">
            Limits and standing permissions
          </h2>
          <Switch
            label="Let approved content calendars post on schedule"
            description="Once you approve a calendar, its recurring posts go out without asking each time. New channels still need approval."
            checked={recurring}
            onCheckedChange={setRecurring}
            disabled={!canManage}
          />
          <Switch
            label="Let ClimbOS pause ads that break your rules"
            description="For example, an ad spending faster than your budget allows. Pausing can only reduce spend; it never starts or raises anything."
            checked={adPause}
            onCheckedChange={setAdPause}
            disabled={!canManage}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Maximum monthly ad spend (${policy.currency})`} hint="ClimbOS will never plan or approve ads beyond this." error={fieldErrors.budget}>
              <Input type="number" inputMode="decimal" min="0" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </Field>
            <Field label="Approvals expire after (hours)" hint="An approval that isn't used in time must be given again." error={fieldErrors.ttl}>
              <Input type="number" inputMode="numeric" min="1" max="336" step="1" value={ttl} onChange={(e) => setTtl(e.target.value)} />
            </Field>
          </div>
        </section>
      </fieldset>

      <div aria-live="polite">
        {error ? (
          <Callout tone="danger" live="none" title="Your rules weren't saved">
            {error}
          </Callout>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!dirty}>
            Save approval rules
          </Button>
          {!dirty ? <span className="text-sm text-ink-3">No changes yet.</span> : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Save new approval rules?"
        description="Changing the rules cancels every existing approval, so anything already approved but not yet live will need to be approved again under the new rules."
        confirmLabel="Save and cancel existing approvals"
        onConfirm={save}
      />
    </form>
  );
}
