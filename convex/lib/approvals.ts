import { approvalHash } from "../../shared/policy";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { activePolicyVersion } from "../jobWrites";

/** Channels ClimbOS publishes to directly, and the connection provider each needs. */
export const DIRECT_PUBLISH: Partial<Record<Doc<"artifacts">["channel"], Doc<"connections">["provider"]>> = {
  instagram: "instagram",
  facebook: "facebook_pages",
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
  await ctx.db.patch(a._id, { status: p.decision === "approve" ? "approved" : "draft", approvalId, updatedAt: now });
  return approvalId;
}
