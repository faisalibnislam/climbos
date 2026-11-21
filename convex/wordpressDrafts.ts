import { wordpressPageTitle } from "../shared/integrations/wordpress";
import { safePublicUrl } from "../shared/net/safeUrl";
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

/** Copy-only rehearsal. The existing page is identified by the owner; its address is never fetched here. */
export const startPageRehearsal = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts"), versionId: v.id("artifactVersions"), title: v.string(), pageUrl: v.string(), sourceRevision: v.string() },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const article = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "article");
    if (article.kind !== "blog_post" || article.channel !== "blog" || article.wordpressPageRehearsal) throw appError("INVALID", "Choose a blog article without an existing baseline.");
    const version = assertSameOrg(await ctx.db.get(args.versionId), org._id, "article version");
    if (article.currentVersionId !== version._id || wordpressPageTitle(version.headline, article.title) !== args.title || version.artifactId !== article._id) throw appError("INVALID", "The source copy changed. Review it again.");
    const url = safePublicUrl(args.pageUrl.trim());
    const sourceRevision = args.sourceRevision.trim();
    if (!url || url.protocol !== "https:" || url.search || url.hash || url.href.length > 2000 || !sourceRevision || sourceRevision.length > 120) throw appError("INVALID", "Use a public HTTPS page address without query parameters and a source revision or capture label.");
    await ctx.db.patch(article._id, { wordpressPageRehearsal: { pageUrl: url.href, sourceRevision, baselineVersionId: version._id, baselineTitle: args.title, revision: 1, showing: "original", changedAt: Date.now() } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "wordpress.baseline_saved", subjectType: "artifact", subjectId: article._id, summary: `Saved v${version.version} as owner-supplied page copy for local comparison.` });
  },
});

export const pageRehearsal = query({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const article = assertSameOrg(await ctx.db.get(artifactId), org._id, "article");
    const saved = article.wordpressPageRehearsal;
    if (!saved) return null;
    const read = async (id: Id<"artifactVersions">, title: string) => {
      const version = assertSameOrg(await ctx.db.get(id), org._id, "article version");
      if (version.artifactId !== article._id) throw appError("INVALID", "The copy does not belong to this article.");
      return { id, version: version.version, title, body: version.body };
    };
    return { pageUrl: saved.pageUrl, sourceRevision: saved.sourceRevision, revision: saved.revision, showing: saved.showing,
      baseline: await read(saved.baselineVersionId, saved.baselineTitle),
      approved: saved.approvedVersionId && saved.approvedTitle !== undefined ? await read(saved.approvedVersionId, saved.approvedTitle) : null };
  },
});

export const reviewPageRehearsal = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts"), revision: v.number(), pageUrl: v.string(), versionId: v.id("artifactVersions"), title: v.string(), decision: v.union(v.literal("approve"), v.literal("restore")) },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
    const article = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "article");
    const saved = article.wordpressPageRehearsal;
    if (!saved || saved.revision !== args.revision || saved.pageUrl !== args.pageUrl) throw appError("INVALID", "The page rehearsal changed. Review the latest comparison.");
    const next = { ...saved, revision: saved.revision + 1, changedAt: Date.now() };
    if (args.decision === "restore") {
      if (saved.showing !== "approved" || saved.baselineVersionId !== args.versionId || saved.baselineTitle !== args.title) throw appError("INVALID", "Review the original version before restoring this rehearsal.");
      next.showing = "original";
    } else {
      const version = assertSameOrg(await ctx.db.get(args.versionId), org._id, "article version");
      if (article.currentVersionId !== version._id || version.artifactId !== article._id || wordpressPageTitle(version.headline, article.title) !== args.title || saved.baselineVersionId === args.versionId) throw appError("INVALID", "Edit the source copy and review the current proposed version.");
      if (saved.showing === "approved" && saved.approvedVersionId === args.versionId && saved.approvedTitle === args.title) return;
      next.approvedVersionId = args.versionId;
      next.approvedTitle = args.title;
      next.showing = "approved";
    }
    await ctx.db.patch(article._id, { wordpressPageRehearsal: next });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `wordpress.rehearsal_${args.decision}`, subjectType: "artifact", subjectId: article._id, summary: `Private copy rehearsal revision ${next.revision}. Reviewed version ${args.versionId}. No external page write.` });
  },
});

/** User-confirmed creation of a private WordPress draft, bound to this exact approved article and site. */
export const createDraft = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts"), reviewed: v.object({
    versionId: v.id("artifactVersions"), contentHash: v.string(), approvalId: v.id("approvals"), connectionId: v.id("connections"), siteUrl: v.string(), title: v.string(),
  }) },
  handler: async (ctx, { slug, artifactId, reviewed }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    if (!(await featureAllowed(ctx, org, "publishing"))) throw appError("PAYMENT_REQUIRED", "WordPress draft creation comes with a package. Choose one in Settings → Billing.");
    await refuseInCopilot(ctx, org._id, "create WordPress drafts");
    if (org.kind === "demo") throw appError("INVALID", "Demo workspaces can't write to a real WordPress site.");
    const { artifact, version, approval, connection } = await validateRequest(ctx, org, artifactId);
    if (reviewed.versionId !== version._id || reviewed.contentHash !== version.contentHash || reviewed.approvalId !== approval._id ||
        reviewed.connectionId !== connection._id || reviewed.siteUrl !== connection.externalAccountId || reviewed.title !== wordpressPageTitle(version.headline, artifact.title)) {
      throw appError("INVALID", "The reviewed article or WordPress destination changed. Open the current version and confirm it again.");
    }
    const idempotencyKey = `${org._id}:wordpress-draft:${artifact._id}:v${version.version}:${approval._id}:${connection._id}`;
    const existing = await ctx.db.query("wordpressDraftOperations").withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey)).first();
    if (existing) {
      if (existing.siteUrl !== reviewed.siteUrl || (existing.reviewedTitle !== undefined && existing.reviewedTitle !== reviewed.title)) {
        throw appError("INVALID", "This version already has a handoff for different terms. Review its outcome and approve a new version.");
      }
      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, { status: "pending", workerClaimed: false, reviewedTitle: reviewed.title, summary: "Retrying the WordPress draft request…", updatedAt: Date.now() });
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
      reviewedTitle: reviewed.title,
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

// A repeated worker invocation must never send a second create request.
export const claimAttempt = internalMutation({
  args: { operationId: v.id("wordpressDraftOperations") },
  handler: async (ctx, { operationId }) => {
    const operation = await ctx.db.get(operationId);
    if (!operation || operation.status !== "pending" || operation.workerClaimed) return false;
    const attemptNumber = (operation.attemptNumber ?? 0) + 1;
    await ctx.db.patch(operationId, { workerClaimed: true, attemptNumber });
    await ctx.scheduler.runAfter(120_000, internal.wordpressDrafts.finishDraft, {
      operationId, expectedAttempt: attemptNumber, status: "uncertain",
      summary: "The draft check did not finish. Inspect WordPress before taking further action.",
    });
    return true;
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
    const safe = operation.status === "pending" && operation.reviewedTitle === wordpressPageTitle(version.headline, artifact.title) && operation.orgId === artifact.orgId && operation.orgId === connection.orgId && connection.provider === "wordpress" && operation.connectionId === connection._id && connection.status === "connected" && !connection.isFixture && operation.siteUrl === connection.externalAccountId && operation.approvalId === artifact.approvalId && operation.contentHash === version.contentHash && currentVersion && approvalCheck.ok;
    return { operation, org, artifact, version, approval, connection, safe, approvalMessage: approvalCheck.ok ? null : approvalCheck.message };
  },
});

export const finishDraft = internalMutation({
  args: { operationId: v.id("wordpressDraftOperations"), status: v.union(v.literal("verified"), v.literal("failed"), v.literal("uncertain")), summary: v.string(), externalPostId: v.optional(v.string()), expectedAttempt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.status !== "pending" || (args.expectedAttempt !== undefined && (!operation.workerClaimed || operation.attemptNumber !== args.expectedAttempt))) return false;
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
