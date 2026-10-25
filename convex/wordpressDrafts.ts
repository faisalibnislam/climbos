import { v } from "convex/values";
import { checkApprovalForExecution } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { featureAllowed, fleetStopped } from "./lib/access";
import { requireOrgAccess, assertSameOrg, appError } from "./lib/tenancy";
import { audit } from "./lib/audit";
import { refuseInCopilot } from "./lib/approvals";

function approvalCurrent({ orgId, artifactId, contentHash, policyVersion, expiresAt }: {
  orgId: Id<"organizations">;
  artifactId: Id<"artifacts">;
  contentHash: string;
  policyVersion: number;
  expiresAt: number;
}) {
  return { orgId, subjectType: "artifact", subjectId: artifactId, actionKind: "export", contentHash, scope: { destination: "blog" }, policyVersion, expiresAt };
}

async function validateRequest(ctx: Parameters<typeof requireOrgAccess>[0], org: Awaited<ReturnType<typeof requireOrgAccess>>["org"], artifactId: Id<"artifacts">) {
  const artifact = assertSameOrg(await ctx.db.get(artifactId), org._id, "article");
  if (artifact.kind !== "blog_post" || artifact.channel !== "blog") throw appError("INVALID", "Only approved blog articles can be sent to WordPress.");
  if (artifact.status !== "approved" || !artifact.currentVersionId || !artifact.approvalId) throw appError("INVALID", "Approve the current article before creating a WordPress draft.");
  const version = await ctx.db.get(artifact.currentVersionId);
  const approval = await ctx.db.get(artifact.approvalId);
  const connection = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "wordpress")).first();
  if (!connection || connection.status !== "connected" || connection.isFixture) throw appError("INVALID", "Connect a real WordPress account first.");
  if (!version || !approval || version.artifactId !== artifact._id || approval.orgId !== org._id || approval.subjectType !== "artifact" || approval.subjectId !== artifact._id) throw appError("INVALID", "The approved article could not be verified.");
  const policy = await ctx.db.query("autonomyPolicies").withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true)).first();
  const policyVersion = policy?.version ?? 1;
  const current = approvalCurrent({ orgId: org._id, artifactId: artifact._id, contentHash: version.contentHash, policyVersion, expiresAt: approval.expiresAt });
  const emergencyStop = Boolean(org.emergencyStop?.active || org.suspendedAt || org.deletedAt) || await fleetStopped(ctx);
  const result = await checkApprovalForExecution({
    approval: { status: approval.status, approvalHash: approval.approvalHash, expiresAt: approval.expiresAt, scope: approval.scope, contentHash: approval.contentHash, policyVersion: approval.policyVersion },
    current,
    now: Date.now(),
    emergencyStop,
    capabilityReady: connection.provider === "wordpress",
  });
  if (!result.ok) throw appError("INVALID", result.message);
  return { artifact, version, approval, connection, policyVersion };
}

/** User-confirmed creation of a private WordPress draft, bound to this exact approved article and site. */
export const createDraft = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    if (!(await featureAllowed(ctx, org, "publishing"))) throw appError("PAYMENT_REQUIRED", "WordPress draft creation comes with a package. Choose one in Settings → Billing.");
    await refuseInCopilot(ctx, org._id, "create WordPress drafts");
    if (org.kind === "demo") throw appError("INVALID", "Demo workspaces can't write to a real WordPress site.");
    const { artifact, version, approval, connection } = await validateRequest(ctx, org, artifactId);
    const idempotencyKey = `${org._id}:wordpress-draft:${artifact._id}:v${version.version}:${approval._id}:${connection._id}`;
    const existing = await ctx.db.query("wordpressDraftOperations").withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey)).first();
    if (existing) {
      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, { status: "pending", summary: "Retrying the WordPress draft request…", updatedAt: Date.now() });
        await ctx.scheduler.runAfter(0, internal.wordpressDraftActions.createDraft, { operationId: existing._id });
        return { operationId: existing._id, status: "pending" as const, summary: "Retrying the WordPress draft request…" };
      }
      return { operationId: existing._id, status: existing.status, summary: existing.summary };
    }
    const now = Date.now();
    const operationId = await ctx.db.insert("wordpressDraftOperations", {
      orgId: org._id,
      artifactId: artifact._id,
      artifactVersionId: version._id,
      approvalId: approval._id,
      connectionId: connection._id,
      requestedBy: user._id,
      siteUrl: connection.externalAccountId ?? "",
      contentHash: version.contentHash,
      idempotencyKey,
      status: "pending",
      summary: "Preparing the WordPress draft…",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.wordpressDraftActions.createDraft, { operationId });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "wordpress.draft_requested", subjectType: "artifact", subjectId: artifact._id, summary: `Requested a WordPress draft for “${artifact.title}” (v${version.version}).` });
    return { operationId, status: "pending" as const, summary: "Preparing the WordPress draft…" };
  },
});

export const forArtifact = query({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    assertSameOrg(await ctx.db.get(artifactId), org._id, "article");
    const rows = await ctx.db.query("wordpressDraftOperations").withIndex("by_artifact", (q) => q.eq("artifactId", artifactId)).order("desc").take(10);
    return rows.filter((row) => row.orgId === org._id).map((row) => ({ id: row._id, status: row.status, summary: row.summary, externalPostId: row.externalPostId ?? null, editUrl: row.editUrl ?? null, createdAt: row.createdAt }));
  },
});

export const draftContext = internalQuery({
  args: { operationId: v.id("wordpressDraftOperations") },
  handler: async (ctx, { operationId }) => {
    const operation = await ctx.db.get(operationId);
    if (!operation) return null;
    const [org, artifact, version, approval, connection, policy] = await Promise.all([
      ctx.db.get(operation.orgId), ctx.db.get(operation.artifactId), ctx.db.get(operation.artifactVersionId), ctx.db.get(operation.approvalId), ctx.db.get(operation.connectionId),
      ctx.db.query("autonomyPolicies").withIndex("by_org_active", (q) => q.eq("orgId", operation.orgId).eq("active", true)).first(),
    ]);
    if (!org || !artifact || !version || !approval || !connection) return null;
    const policyVersion = policy?.version ?? 1;
    const current = approvalCurrent({ orgId: operation.orgId, artifactId: operation.artifactId, contentHash: version.contentHash, policyVersion, expiresAt: approval.expiresAt });
    const emergencyStop = Boolean(org.emergencyStop?.active || org.suspendedAt || org.deletedAt) || await fleetStopped(ctx);
    const approvalCheck = await checkApprovalForExecution({
      approval: { status: approval.status, approvalHash: approval.approvalHash, expiresAt: approval.expiresAt, scope: approval.scope, contentHash: approval.contentHash, policyVersion: approval.policyVersion },
      current,
      now: Date.now(),
      emergencyStop,
      capabilityReady: connection.provider === "wordpress" && connection.status === "connected" && !connection.isFixture,
    });
    const currentVersion = artifact.kind === "blog_post" && artifact.channel === "blog" && artifact.currentVersionId === version._id && artifact.currentVersion === version.version && artifact.status === "approved";
    const safe = operation.status === "pending" && operation.orgId === artifact.orgId && operation.orgId === connection.orgId && connection.provider === "wordpress" && operation.connectionId === connection._id && connection.status === "connected" && !connection.isFixture && operation.siteUrl === connection.externalAccountId && operation.approvalId === artifact.approvalId && operation.contentHash === version.contentHash && currentVersion && approvalCheck.ok;
    return { operation, org, artifact, version, approval, connection, safe, approvalMessage: approvalCheck.ok ? null : approvalCheck.message };
  },
});

export const finishDraft = internalMutation({
  args: { operationId: v.id("wordpressDraftOperations"), status: v.union(v.literal("verified"), v.literal("failed"), v.literal("uncertain")), summary: v.string(), externalPostId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.status !== "pending") return false;
    let editUrl: string | undefined;
    if (operation.siteUrl && args.externalPostId && /^\d{1,20}$/u.test(args.externalPostId)) {
      const site = new URL(operation.siteUrl);
      editUrl = new URL(`${site.pathname.replace(/\/+$/u, "")}/wp-admin/post.php?post=${args.externalPostId}&action=edit`, site.origin).toString();
    }
    await ctx.db.patch(operation._id, { status: args.status, summary: args.summary.slice(0, 400), externalPostId: args.externalPostId?.slice(0, 80), editUrl: editUrl ?? undefined, updatedAt: Date.now() });
    await audit(ctx, { orgId: operation.orgId, actorType: "system", action: `wordpress.draft_${args.status}`, subjectType: "artifact", subjectId: operation.artifactId, summary: args.summary.slice(0, 300) });
    return true;
  },
});
