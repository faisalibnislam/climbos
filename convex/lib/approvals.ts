import { approvalHash } from "../../shared/policy";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./tenancy";
import { activePolicyVersion } from "../jobWrites";

/** Channels ClimbOS publishes to directly, and the connection provider each needs. */
export const DIRECT_PUBLISH: Partial<Record<Doc<"artifacts">["channel"], Doc<"connections">["provider"]>> = {
  instagram: "instagram",
  facebook: "facebook_pages",
  linkedin: "linkedin",
  x: "x",
};

export async function invalidateApprovals(ctx: MutationCtx, artifactId: Id<"artifacts">, reason: string) {
  const approvals = await ctx.db
    .query("approvals")
    .withIndex("by_subject", (q) => q.eq("subjectType", "artifact").eq("subjectId", artifactId))
    .take(20);
  for (const ap of approvals) {
    if (ap.status === "pending" || ap.status === "approved") {
      await ctx.db.patch(ap._id, { status: "invalidated", invalidatedReason: reason });
    }
  }
}

/** The connected account an artifact would publish through, if any. */
export async function publishTarget(ctx: MutationCtx, orgId: Id<"organizations">, channel: Doc<"artifacts">["channel"]) {
  const provider = DIRECT_PUBLISH[channel];
  if (!provider) return { provider: null, connection: null };
  const connection = await ctx.db
    .query("connections")
    .withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", provider))
    .first();
  return { provider, connection: connection?.status === "connected" ? connection : null };
}

/**
 * Record a decision on an artifact's current version, bound to its content
 * hash, destination, connection and policy version, exactly as the publish
 * executor re-checks it. `decidedBy` is absent for autopilot decisions.
 */
export async function recordArtifactDecision(
  ctx: MutationCtx,
  p: {
    org: Doc<"organizations">;
    artifact: Doc<"artifacts">;
    version: Doc<"artifactVersions">;
    decision: "approve" | "reject";
    decidedBy?: Id<"users">;
    note?: string;
  },
): Promise<Id<"approvals">> {
  const { org, artifact: a, version: ver } = p;
  const policy = await ctx.db
    .query("autonomyPolicies")
    .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
    .first();
  const policyVersion = policy?.version ?? (await activePolicyVersion(ctx, org._id));
  const { connection } = await publishTarget(ctx, org._id, a.channel);
  const now = Date.now();
  const expiresAt = now + (policy?.approvalTtlHours ?? 72) * 3_600_000;
  const scope = { connectionId: connection ? connection._id : undefined, destination: a.channel };
  const actionKind = connection ? "publish" : "export";
  const binding = { orgId: org._id, subjectType: "artifact", subjectId: a._id, actionKind, contentHash: ver.contentHash, scope, policyVersion, expiresAt };
  await invalidateApprovals(ctx, a._id, "Superseded by a newer decision");
  const approvalId = await ctx.db.insert("approvals", {
    orgId: org._id,
    subjectType: "artifact",
    subjectId: a._id,
    actionKind,
    title: a.title,
    contentHash: ver.contentHash,
    scope,
    costEstimateMicros: 0,
    policyVersion,
    approvalHash: await approvalHash(binding),
    status: p.decision === "approve" ? "approved" : "rejected",
    requestedBy: a.createdBy,
    decidedBy: p.decidedBy,
    decidedAt: now,
    decisionNote: p.note?.slice(0, 500),
    expiresAt,
    createdAt: now,
  });
  await ctx.db.patch(a._id, { status: p.decision === "approve" ? "approved" : "draft", approvalId, lastPublishError: undefined, updatedAt: now });
  return approvalId;
}

/** Scheduled posts keep their approval until a little after the planned time. */
export const SCHEDULE_GRACE_MS = 6 * 3_600_000;

/**
 * Keep an artifact's approval valid until `until` (re-hashed, since the expiry
 * is part of the binding). Returns false when there is no live approval.
 */
export async function extendApprovalUntil(ctx: MutationCtx, a: Doc<"artifacts">, until: number): Promise<boolean> {
  const ap = a.approvalId ? await ctx.db.get(a.approvalId) : null;
  if (!ap || ap.status !== "approved" || ap.expiresAt <= Date.now()) return false;
  if (ap.expiresAt >= until) return true;
  const binding = { orgId: ap.orgId, subjectType: ap.subjectType, subjectId: ap.subjectId, actionKind: ap.actionKind, contentHash: ap.contentHash, scope: ap.scope, policyVersion: ap.policyVersion, expiresAt: until };
  await ctx.db.patch(ap._id, { expiresAt: until, approvalHash: await approvalHash(binding) });
  return true;
}

/**
 * Why an artifact's approval can't be used as it stands, or null when it can:
 * missing, expired, for older content, or made for a different destination
 * (e.g. approved for export before the account was connected).
 */
export function approvalProblem(
  ap: Doc<"approvals"> | null,
  ver: Doc<"artifactVersions"> | null,
  connection: Doc<"connections"> | null,
  now = Date.now(),
): string | null {
  if (!ap || ap.status !== "approved") return "Approve this first.";
  if (ap.expiresAt <= now) return "The approval expired. Approve it again first.";
  if (!ver || ap.contentHash !== ver.contentHash) return "The content changed after approval. Approve the new version.";
  const wanted = connection ? "publish" : "export";
  if (ap.actionKind !== wanted || (ap.scope.connectionId ?? null) !== (connection?._id ?? null)) {
    return connection ? "Approved before this account was connected. Approve it again to publish it." : "The connected account changed. Approve it again.";
  }
  return null;
}

/** The workspace's autonomy mode (Settings → Policies); "review" when none is set. */
export async function autonomyMode(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">): Promise<"copilot" | "review" | "bounded_autopilot"> {
  const p = await ctx.db.query("autonomyPolicies").withIndex("by_org_active", (q) => q.eq("orgId", orgId).eq("active", true)).first();
  return (p?.mode as "copilot" | "review" | "bounded_autopilot" | undefined) ?? "review";
}

/** Copilot mode promises the owner posts, sends and launches everything themselves. */
export async function refuseInCopilot(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, what: string): Promise<void> {
  if ((await autonomyMode(ctx, orgId)) === "copilot") throw appError("INVALID", `Copilot mode is on, so ClimbOS doesn't ${what} for you. Use the export, or switch to Review in Settings → Policies.`);
}
