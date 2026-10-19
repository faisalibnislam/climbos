"use client";

import { CircleAlert, CircleCheck, CircleQuestionMark, FileText, FlaskConical, type LucideIcon } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, Callout, type Tone } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDateTime, relativeTime } from "../../money";
import { MessageText, channelLabel } from "../shared";
import type { ArtifactView } from "./model";

/* ---------------- Flagged claims ---------------- */

export function FlaggedClaims({ claims }: { claims: string[] }) {
  if (claims.length === 0) return null;
  return (
    <Callout tone="warning" title={`${claims.length} unverified claim${claims.length === 1 ? "" : "s"}`}>
      <p>No confirmed fact backs {claims.length === 1 ? "it" : "them"}. Edit out, or approve only if true.</p>
      <ul className="mt-2 list-disc pl-5">
        {claims.map((c) => (
          <li key={c} className="font-medium text-ink">
            “{c}”
          </li>
        ))}
      </ul>
    </Callout>
  );
}

/* ---------------- Version history ---------------- */

export function VersionHistory({ artifact, myUserId, now }: { artifact: ArtifactView; myUserId: string | null; now: number | null }) {
  const [open, setOpen] = useState<string | null>(null);
  if (artifact.versions.length === 0) return <p className="text-sm text-ink-3">No versions yet.</p>;
  return (
    <ol className="flex flex-col divide-y divide-line">
      {artifact.versions.map((v, i) => {
        const isOpen = open === v.id;
        const panelId = `version-${v.id}`;
        return (
          <li key={v.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  Version {v.version}
                  {i === 0 ? <Badge tone="green">Current</Badge> : null}
                </span>
                <span className="text-xs text-ink-3">
                  {v.editedByRole ? "AI" : v.editedByUser ? (v.editedByUser === myUserId ? "You" : (v.editedByName ?? "Teammate")) : "AI"}
                  {" · "}
                  <time dateTime={new Date(v.createdAt).toISOString()} title={now ? formatDateTime(v.createdAt) : undefined}>
                    {now ? relativeTime(v.createdAt, now) : ""}
                  </time>
                </span>
              </div>
              {i > 0 ? (
                <Button size="sm" variant="ghost" aria-expanded={isOpen} aria-controls={panelId} aria-label={`${isOpen ? "Hide" : "View"} version ${v.version}`} onClick={() => setOpen(isOpen ? null : v.id)}>
                  {isOpen ? "Hide" : "View"}
                </Button>
              ) : null}
            </div>
            {isOpen ? (
              <div id={panelId} className="rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink-2">
                {v.headline ? <p className="font-semibold text-ink">{v.headline}</p> : null}
                <p className="whitespace-pre-wrap break-words">{v.body}</p>
                {v.hashtags.length ? <p className="mt-2 break-words text-ink-3">{v.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}</p> : null}
                {v.destinationUrl ? <p className="mt-2 break-words text-ink-3">Link: {v.destinationUrl}</p> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Facts ---------------- */

const FACT_STATE: Record<string, { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed", tone: "green" },
  edited: { label: "Edited", tone: "green" },
  needs_review: { label: "Needs review", tone: "amber" },
  rejected: { label: "Rejected", tone: "red" },
};

export function FactsList({ facts }: { facts: ArtifactView["facts"] }) {
  if (facts.length === 0) {
    return <p className="text-sm text-ink-3">None.</p>;
  }
  const unreviewed = facts.filter((f) => f.reviewState === "needs_review" || f.reviewState === "rejected").length;
  return (
    <div className="flex flex-col gap-3">
      {unreviewed > 0 ? (
        <p className="text-sm font-medium text-amber-800">
          {unreviewed} unconfirmed. Check before approving.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {facts.map((f) => {
          const s = FACT_STATE[f.reviewState] ?? { label: f.reviewState, tone: "neutral" as Tone };
          return (
            <li key={f.id} className="flex flex-col gap-1.5">
              <span className="text-sm text-ink">{f.statement}</span>
              <Badge tone={s.tone} className="self-start">
                {s.label}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- Approvals ---------------- */

export function approvalLabel(a: ArtifactView["approvals"][number], now: number | null): { label: string; tone: Tone; detail?: string } {
  if (a.status === "approved") {
    if (now !== null && a.expiresAt < now) return { label: "Expired", tone: "neutral" };
    if (!a.isCurrent) return { label: "Older version", tone: "neutral" };
    return { label: "Approved", tone: "green", detail: now !== null ? `Until ${formatDateTime(a.expiresAt)}` : undefined };
  }
  if (a.status === "invalidated") return { label: "Cancelled", tone: "neutral", detail: a.invalidatedReason ?? undefined };
  if (a.status === "expired") return { label: "Expired", tone: "neutral" };
  if (a.status === "consumed") return { label: "Used to publish", tone: "blue" };
  if (a.status === "rejected") return { label: "Sent back", tone: "amber" };
  if (a.status === "pending") return { label: "Pending", tone: "amber" };
  return { label: a.status, tone: "neutral" };
}

export function ApprovalsList({ approvals, now }: { approvals: ArtifactView["approvals"]; now: number | null }) {
  if (approvals.length === 0) return <p className="text-sm text-ink-3">None yet.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {approvals.map((a) => {
        const l = approvalLabel(a, now);
        return (
          <li key={a.id} className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={l.tone}>{l.label}</Badge>
              {a.decidedAt && now ? <span className="text-xs text-ink-3">{relativeTime(a.decidedAt, now)}</span> : null}
            </span>
            {l.detail ? <span className="text-xs text-ink-3">{l.detail}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Receipts ---------------- */

const RECEIPT: Record<string, { label: string; Icon: LucideIcon; cls: string }> = {
  fixture_verified: { label: "Demo: simulated acceptance", Icon: FlaskConical, cls: "text-violet-800" },
  verified: { label: "Accepted by platform", Icon: CircleCheck, cls: "text-brand-800" },
  uncertain: { label: "Outcome uncertain", Icon: CircleQuestionMark, cls: "text-amber-800" },
  exported: { label: "Exported", Icon: FileText, cls: "text-violet-800" },
  failed: { label: "Not posted", Icon: CircleAlert, cls: "text-red-800" },
};

const PROVIDER_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook_pages: "Facebook Page",
  manual: "Manual export",
  resend_marketing: "Resend",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
};

export function ReceiptsTimeline({ receipts, now }: { receipts: ArtifactView["receipts"]; now: number | null }) {
  if (receipts.length === 0) {
    return <p className="text-sm text-ink-3">Nothing sent yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-4">
      {receipts.map((r) => {
        const meta = RECEIPT[r.status] ?? { label: r.status, Icon: CircleQuestionMark, cls: "text-ink-2" };
        return (
          <li key={r.id} className="flex gap-3">
            <meta.Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", meta.cls)} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={cn("text-sm font-semibold", meta.cls)}>{meta.label}</span>
              <span className="text-xs text-ink-3">
                {PROVIDER_LABEL[r.provider] ?? channelLabel(r.provider)}
                {now ? ` · ${formatDateTime(r.createdAt)}` : ""}
              </span>
              <MessageText text={r.summary} className="break-words text-sm text-ink-2" />
              {r.externalId ? <span className="break-all text-xs text-ink-3">Ref: {r.externalId}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
