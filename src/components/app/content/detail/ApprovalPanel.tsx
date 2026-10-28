"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Callout, ConfirmDialog, Field, Textarea, toast } from "@/components/ui";
import { formatDateTime } from "../../money";
import { toBullets } from "@/components/ds/content";
import { ErrorCallout, MessageText, NoteList, PERMISSION_WHO, channelLabel } from "../shared";
import { ApprovalsList } from "./HistoryPanels";
import { isCampaignAd, type ArtifactView } from "./model";

const SLOT_TOAST: Record<string, string> = {
  scheduled: "Approved. Autopilot will post it.",
  needs_time: "Approved. Pick a new time.",
  ready_to_post: "Approved. Ready to post.",
};

export function hasValidApproval(artifact: ArtifactView, now: number | null): boolean {
  // Approved for export before the account was connected, or similar: needs a fresh approval.
  if (artifact.approvalProblem && artifact.publishTarget?.connected) return false;
  // No decision records (e.g. seeded demo data): trust the status; the backend re-checks before sending.
  if (artifact.approvals.length === 0) return artifact.status === "approved" || artifact.status === "scheduled";
  return artifact.approvals.some((a) => a.status === "approved" && a.isCurrent && (now === null || a.expiresAt > now));
}

export function approveConsequence(artifact: ArtifactView, now: number | null): string {
  const ch = channelLabel(artifact.channel);
  const v = artifact.current?.version ?? 1;
  const demo = artifact.isDemo ? " Demo: simulated." : "";
  const slot = artifact.autopilotSlot;
  if (slot && artifact.publishTarget?.connected) {
    const when = formatDateTime(slot.slotAt);
    return now === null || slot.slotAt > now + 120_000
      ? `Autopilot posts v${v} to ${ch} at ${when}. Edits cancel approval.${demo}`
      : `Planned time (${when}) passed. Pick a new time or publish now.${demo}`;
  }
  if (isCampaignAd(artifact.channel)) {
    const platform = artifact.channel === "google_search_ad" ? "Google Ads" : "Meta";
    return `Approves ad text v${v} only. Nothing is created in ${platform} or spent until you approve a campaign. Edits cancel approval.${demo}`;
  }
  const t = artifact.publishTarget;
  if (t?.connected) {
    const account = t.accountLabel ? `${t.accountLabel} on ${ch}` : ch;
    return `Lets ClimbOS publish v${v} to ${account}. Nothing goes out until you schedule or publish. Edits cancel approval.${demo}`;
  }
  return `Marks v${v} ready. ClimbOS can't post to ${ch}${t ? " until connected" : ""}: copy it from the export pack. Edits cancel approval.${demo}`;
}

/** Approve / Send back (reviewer roles) + decision history. */
export function ApprovalPanel({ slug, artifact, now }: { slug: string; artifact: ArtifactView; now: number | null }) {
  const decide = useMutation(api.content.decide);
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const valid = hasValidApproval(artifact, now);
  const claims = artifact.current?.unsupportedClaims ?? [];
  // Uncertain posts are settled first ("It was posted" / "It wasn't posted"); then they can be approved again.
  const decidable =
    Boolean(artifact.current) &&
    (["draft", "in_review", "failed"].includes(artifact.status) || (artifact.status === "approved" && !valid));
  const needsImage = artifact.channel === "instagram" && !artifact.isDemo && !artifact.current?.imageUrl && !artifact.reel;
  // Lead with what approving does; the conditions follow as notes.
  const [consequence = "", ...conditions] = toBullets(approveConsequence(artifact, now));

  const run = async (decision: "approve" | "reject") => {
    setError(null);
    try {
      const res = await decide({ slug, artifactId: artifact.id, decision, note: decision === "reject" && note.trim() ? note.trim() : undefined });
      toast({ tone: "success", title: decision === "approve" ? (SLOT_TOAST[res.slot] ?? "Approved.") : "Sent back to draft." });
      setNote("");
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {artifact.status === "approved" && !valid && (artifact.approvals.length > 0 || artifact.approvalProblem) ? (
        <Callout tone="warning" title={artifact.approvalProblem && artifact.publishTarget?.connected ? "Approve it again" : "The approval has expired"}>
          {artifact.approvalProblem && artifact.publishTarget?.connected ? <MessageText text={artifact.approvalProblem} /> : "Re-approve before publishing."}
        </Callout>
      ) : null}
      {decidable && needsImage ? (
        <Callout tone="info" title="Add an image first">
          Instagram needs one. Edit to add it.
        </Callout>
      ) : null}
      {decidable ? (
        artifact.canApprove ? (
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <ConfirmDialog
              trigger={
                <Button className="sm:flex-1" disabled={needsImage}>
                  Approve
                </Button>
              }
              title={`Approve version ${artifact.current?.version ?? 1}?`}
              description={`${consequence}.`}
              confirmLabel={claims.length ? "Approve anyway" : "Approve"}
              onConfirm={() => run("approve")}
            >
              <NoteList items={conditions} />
              {claims.length > 0 ? (
                <Callout tone="warning" className={conditions.length ? "mt-3" : undefined} title={`${claims.length} unchecked claim${claims.length === 1 ? "" : "s"}`}>
                  <ul className="list-disc pl-5">
                    {claims.map((c) => (
                      <li key={c}>“{c}”</li>
                    ))}
                  </ul>
                </Callout>
              ) : null}
            </ConfirmDialog>
            <ConfirmDialog
              trigger={
                <Button variant="secondary" className="sm:flex-1">
                  Send back
                </Button>
              }
              title="Send back for changes?"
              description="Returns to draft. Nothing is posted."
              confirmLabel="Send back"
              onConfirm={() => run("reject")}
            >
              <Field label="What should change?" optional>
                <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} maxLength={500} />
              </Field>
            </ConfirmDialog>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Needs approval from {PERMISSION_WHO.approve}.</p>
        )
      ) : null}
      {error ? <ErrorCallout error={error} /> : null}
      <div>
        <h3 className="heading-card mb-2">Decisions</h3>
        <ApprovalsList approvals={artifact.approvals} now={now} />
      </div>
    </div>
  );
}
