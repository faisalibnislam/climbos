"use client";

/*
 * Profile: ProfileCompletion (ring + checklist with next steps) and
 * VerificationBadge (verified / pending / unverified, icon + text).
 */
import type { ReactNode } from "react";
import { ArrowRight, CircleCheck, Hourglass, ShieldAlert, ShieldCheck } from "@/components/icons";
import { Button, ProgressRing, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface CompletionStep {
  id: string;
  label: string;
  /** Why it matters, one line. */
  hint?: string;
  done: boolean;
}

export interface ProfileCompletionProps {
  steps: CompletionStep[];
  onStep: (id: string) => void;
  title?: string;
}

/** How complete a profile is, and the next things to do. Done steps collapse to a tick. */
export function ProfileCompletion({ steps, onStep, title = "Finish your profile" }: ProfileCompletionProps) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="flex items-center gap-4">
        <ProgressRing value={pct / 100} size={56} label="Profile complete">
          <span className="text-xs font-semibold tabular-nums">{pct}%</span>
        </ProgressRing>
        <div>
          <h3 className="heading-card">{pct === 100 ? "Profile complete" : title}</h3>
          <p className="text-xs text-ink-3">
            {done} of {steps.length} done{pct < 100 ? " · complete profiles get better plays" : ""}
          </p>
        </div>
      </div>
      <ul className="flex flex-col">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
            {s.done ? (
              <CircleCheck aria-hidden className="size-4 shrink-0 text-green-800" />
            ) : (
              <span aria-hidden className="size-4 shrink-0 rounded-full border-[1.5px] border-dashed border-control" />
            )}
            <span className="min-w-0 flex-1">
              <span className={cn("block text-ui", s.done ? "text-ink-3 line-through" : "font-medium text-ink")}>
                {s.label}
                <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
              </span>
              {!s.done && s.hint ? <span className="block text-xs text-ink-3">{s.hint}</span> : null}
            </span>
            {!s.done ? (
              <Button size="sm" variant="secondary" onClick={() => onStep(s.id)}>
                Add <ArrowRight />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export type VerificationStatus = "verified" | "pending" | "unverified";

const VERIFY: Record<VerificationStatus, { Icon: typeof ShieldCheck; cls: string; word: string }> = {
  verified: { Icon: ShieldCheck, cls: "bg-green-100 text-green-800", word: "Verified" },
  pending: { Icon: Hourglass, cls: "bg-amber-100 text-amber-800", word: "Pending" },
  unverified: { Icon: ShieldAlert, cls: "bg-red-100 text-red-800", word: "Not verified" },
};

export interface VerificationBadgeProps {
  status: VerificationStatus;
  /** What is verified, e.g. "Email", "Domain", "Business". */
  subject?: string;
  /** Extra detail in a tooltip, e.g. "Checked via DNS on 12 Oct". */
  detail?: ReactNode;
  /** Icon-only mark next to a name (still announced). */
  compact?: boolean;
}

/** Verification state for an email, domain or business. Text always names the state. */
export function VerificationBadge({ status, subject, detail, compact }: VerificationBadgeProps) {
  const { Icon, cls, word } = VERIFY[status];
  const text = subject ? `${subject} ${word.toLowerCase()}` : word;
  const node = compact ? (
    <span tabIndex={detail ? 0 : undefined} role="img" aria-label={text} className={cn("inline-grid size-5 place-items-center rounded-full", cls)}>
      <Icon aria-hidden className="size-3" />
    </span>
  ) : (
    <span tabIndex={detail ? 0 : undefined} className={cn("inline-flex h-6 items-center gap-1 rounded-[var(--radius-badge)] px-2 text-xs font-medium", cls)}>
      <Icon aria-hidden className="size-3.5" />
      {text}
    </span>
  );
  return detail ? <Tooltip content={detail}>{node}</Tooltip> : node;
}
