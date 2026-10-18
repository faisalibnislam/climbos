"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Callout, ConfirmDialog, Field, Textarea, toast } from "@/components/ui";
import { formatDateTime } from "../../money";
import { ErrorCallout, PERMISSION_WHO, channelLabel } from "../shared";
import { ApprovalsList } from "./HistoryPanels";
import { isCampaignAd, type ArtifactView } from "./model";

const SLOT_TOAST: Record<string, string> = {
  scheduled: "Approved. Autopilot posts it at its planned time.",
  needs_time: "Approved. Its planned time has passed: pick a new time below.",
  ready_to_post: "Approved. It's ready for you to post or schedule.",
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
  const demo = artifact.isDemo ? " This is a demo workspace, so publishing is simulated — nothing is really posted." : "";
  const slot = artifact.autopilotSlot;
  if (slot && artifact.publishTarget?.connected) {
    const when = formatDateTime(slot.slotAt);
    return now === null || slot.slotAt > now + 120_000
      ? `Autopilot posts this exact version (version ${v}) to ${ch} at its planned time, ${when}. Any edit cancels this approval.${demo}`
      : `Its planned time (${when}) has passed, so nothing goes out on its own. After approving, pick a new time or publish it now.${demo}`;
  }
  if (isCampaignAd(artifact.channel)) {
    const platform = artifact.channel === "google_search_ad" ? "Google Ads" : "Meta";
    return `Approving the ad text (version ${v}) lets you prepare a campaign. Nothing is created in ${platform} and no money is spent until you separately approve creating and starting a campaign. Any edit cancels this approval.${demo}`;
  }
  const t = artifact.publishTarget;
  if (t?.connected) {
    const account = t.accountLabel ? `${t.accountLabel} on ${ch}` : ch;
    return `Approving lets ClimbOS publish this exact version (version ${v}) to ${account}. Nothing goes out until you schedule it or press Publish now. Any edit cancels this approval.${demo}`;
  }
  return `Approving marks this exact version (version ${v}) as ready. ClimbOS can't post to ${ch} for you${t ? " until it's connected" : " yet"}, so you'll copy it from the export pack and post it yourself. Any edit cancels this approval.${demo}`;
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
          {artifact.approvalProblem && artifact.publishTarget?.connected ? artifact.approvalProblem : "Approve it again before scheduling or publishing."}
        </Callout>
      ) : null}
      {decidable && needsImage ? (
        <Callout tone="info" title="Add an image first">
          Instagram posts need an image. Edit the post and pick one from your images.
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
              description={approveConsequence(artifact, now)}
              confirmLabel={claims.length ? "Approve anyway" : "Approve this version"}
              onConfirm={() => run("approve")}
            >
              {claims.length > 0 ? (
                <Callout tone="warning" title={`${claims.length} claim${claims.length === 1 ? "" : "s"} couldn't be checked`}>
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
              title="Send this back for changes?"
              description="It goes back to draft. Nothing is posted. Your note helps the team revise it."
              confirmLabel="Send back to draft"
              onConfirm={() => run("reject")}
            >
              <Field label="What should change?" optional>
                <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} maxLength={500} />
              </Field>
            </ConfirmDialog>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Waiting for approval from {PERMISSION_WHO.approve}. You can still edit the draft if your role allows it.</p>
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
