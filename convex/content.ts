import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { buildManualExportPack, manualExportToCsv, type DraftPlatform } from "../shared/integrations/drafts";
import { approvalHash, contentHash } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { artifactStatusValidator, channelValidator } from "./schema";
import { createRunWithReservation } from "./engine";
import { activePolicyVersion } from "./jobWrites";
import { audit } from "./lib/audit";
import { estimateJobMicros, planJob } from "./lib/jobPlans";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

const DIRECT_PUBLISH: Partial<Record<Doc<"artifacts">["channel"], Doc<"connections">["provider"]>> = {
  instagram: "instagram",
  facebook: "facebook_pages",
};

async function versionView(ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } }, v: Doc<"artifactVersions">) {
  return {
    id: v._id,
    version: v.version,
    headline: v.headline ?? null,
    body: v.body,
    callToAction: v.callToAction ?? null,
    destinationUrl: v.destinationUrl ?? null,
    hashtags: v.hashtags,
    altText: v.altText ?? null,
    imageUrl: v.imageStorageId ? await ctx.storage.getUrl(v.imageStorageId) : null,
    imageLabel: v.imageLabel ?? null,
    imagePrompt: v.imagePrompt ?? null,
    unsupportedClaims: v.unsupportedClaims,
    claimFactIds: v.claimFactIds,
    editedByRole: v.editedByRole ?? null,
    editedByUser: v.editedByUser ?? null,
    createdAt: v.createdAt,
  };
}

export const list = query({
  args: {
    slug: v.string(),
    status: v.optional(artifactStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { slug, status, paginationOpts }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const page = status
      ? await ctx.db
          .query("artifacts")
          .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", status))
          .order("desc")
          .paginate(paginationOpts)
      : await ctx.db
          .query("artifacts")
          .withIndex("by_org_updated", (q) => q.eq("orgId", org._id))
          .order("desc")
          .paginate(paginationOpts);
    const items = await Promise.all(
      page.page.map(async (a) => {
        const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
        return {
          id: a._id,
          kind: a.kind,
          channel: a.channel,
          title: a.title,
          status: a.status,
          scheduledFor: a.scheduledFor ?? null,
          createdByRole: a.createdByRole ?? null,
          updatedAt: a.updatedAt,
          preview: ver?.body.slice(0, 220) ?? "",
          hasImage: Boolean(ver?.imageStorageId),
          flags: ver?.unsupportedClaims.length ?? 0,
        };
      }),
    );
    return { ...page, page: items };
  },
});

export const calendar = query({
  args: { slug: v.string(), from: v.number(), to: v.number() },
  handler: async (ctx, { slug, from, to }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    if (to - from > 62 * 86_400_000) throw appError("INVALID", "Pick a shorter date range.");
    const rows = await ctx.db
      .query("artifacts")
      .withIndex("by_org_scheduled", (q) => q.eq("orgId", org._id).gte("scheduledFor", from).lt("scheduledFor", to))
      .take(300);
    return rows.map((a) => ({ id: a._id, title: a.title, channel: a.channel, status: a.status, scheduledFor: a.scheduledFor! }));
  },
});

export const get = query({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    const versions = await ctx.db
      .query("artifactVersions")
      .withIndex("by_artifact", (q) => q.eq("artifactId", a._id))
      .order("desc")
      .take(20);
    const approvals = await ctx.db
      .query("approvals")
      .withIndex("by_subject", (q) => q.eq("subjectType", "artifact").eq("subjectId", a._id))
      .order("desc")
      .take(10);
    const receipts = (
      await ctx.db
        .query("actionReceipts")
        .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
        .order("desc")
        .take(200)
    ).filter((r) => r.artifactId === a._id);
    const factIds = versions[0]?.claimFactIds ?? [];
    const facts = [];
    for (const id of factIds.slice(0, 20)) {
      const f = await ctx.db.get(id);
      if (f && f.orgId === org._id) facts.push({ id: f._id, statement: f.statement, reviewState: f.reviewState });
    }
    const target = DIRECT_PUBLISH[a.channel];
    const conn = target
      ? await ctx.db
          .query("connections")
          .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", target))
          .first()
      : null;
    return {
      id: a._id,
      kind: a.kind,
      channel: a.channel,
      title: a.title,
      status: a.status,
      scheduledFor: a.scheduledFor ?? null,
      createdByRole: a.createdByRole ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      current: versions[0] ? await versionView(ctx, versions[0]) : null,
      versions: await Promise.all(versions.map((ver) => versionView(ctx, ver))),
      approvals: approvals.map((ap) => ({
        id: ap._id,
        status: ap.status,
        expiresAt: ap.expiresAt,
        decidedAt: ap.decidedAt ?? null,
        invalidatedReason: ap.invalidatedReason ?? null,
        contentHash: ap.contentHash,
        isCurrent: ap.contentHash === versions[0]?.contentHash,
      })),
      receipts: receipts.map((r) => ({ id: r._id, provider: r.provider, action: r.action, status: r.status, externalId: r.externalId ?? null, summary: r.summary, createdAt: r.createdAt })),
      facts,
      publishTarget: target
        ? {
            provider: target,
            connected: conn?.status === "connected",
            isFixture: conn?.isFixture ?? false,
            accountLabel: conn?.accountLabel ?? null,
          }
        : null,
      canEdit: ["owner", "admin", "editor"].includes(role),
      canApprove: ["owner", "admin", "reviewer"].includes(role),
      isDemo: org.kind === "demo",
    };
  },
});

async function invalidateApprovals(ctx: MutationCtx, artifactId: Id<"artifacts">, reason: string) {
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

/** Editing creates a new version. Any material change invalidates existing approvals. */
export const edit = mutation({
  args: {
    slug: v.string(),
    artifactId: v.id("artifacts"),
    title: v.optional(v.string()),
    headline: v.optional(v.string()),
    body: v.string(),
    callToAction: v.optional(v.string()),
    destinationUrl: v.optional(v.string()),
    hashtags: v.array(v.string()),
    altText: v.optional(v.string()),
    removeImage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "draft");
    if (["publishing", "published"].includes(a.status)) throw appError("INVALID", "Published content can't be edited. Duplicate it instead.");
    const prev = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    const body = args.body.trim().slice(0, 20_000);
    if (!body) throw appError("INVALID", "The text can't be empty.");
    if (args.destinationUrl && !/^https:\/\//i.test(args.destinationUrl.trim())) {
      throw appError("INVALID", "Links must start with https://");
    }
    const imageStorageId = args.removeImage ? undefined : prev?.imageStorageId;
    const ch = await contentHash({
      headline: args.headline,
      body,
      callToAction: args.callToAction,
      destinationUrl: args.destinationUrl,
      hashtags: args.hashtags,
      altText: args.altText,
      imageRef: imageStorageId,
      channel: a.channel,
    });
    if (prev && prev.contentHash === ch && (!args.title || args.title === a.title)) return { changed: false };
    const version = a.currentVersion + 1;
    const now = Date.now();
    const versionId = await ctx.db.insert("artifactVersions", {
      orgId: org._id,
      artifactId: a._id,
      version,
      headline: args.headline?.slice(0, 500),
      body,
      callToAction: args.callToAction?.slice(0, 120),
      destinationUrl: args.destinationUrl?.trim(),
      hashtags: args.hashtags.slice(0, 30).map((h) => h.slice(0, 60)),
      altText: args.altText?.slice(0, 1000),
      imageStorageId,
      imagePrompt: prev?.imagePrompt,
      imageLabel: imageStorageId ? prev?.imageLabel : undefined,
      claimFactIds: prev?.claimFactIds ?? [],
      unsupportedClaims: [],
      contentHash: ch,
      editedByUser: user._id,
      createdAt: now,
    });
    await invalidateApprovals(ctx, a._id, "Edited after approval");
    await ctx.db.patch(a._id, {
      title: args.title?.trim().slice(0, 140) || a.title,
      currentVersionId: versionId,
      currentVersion: version,
      status: a.status === "archived" ? "archived" : "in_review",
      updatedAt: now,
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.edited", subjectType: "artifact", subjectId: a._id, summary: `Edited "${a.title}" (v${version}). Any earlier approval no longer applies.` });
    return { changed: true, version };
  },
});

/** Approve or reject the CURRENT version. The approval binds to its content hash, destination and policy. */
export const decide = mutation({
  args: {
    slug: v.string(),
    artifactId: v.id("artifacts"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
    const a = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "draft");
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    if (!ver) throw appError("INVALID", "Nothing to approve yet.");
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    const policyVersion = policy?.version ?? (await activePolicyVersion(ctx, org._id));
    const target = DIRECT_PUBLISH[a.channel];
    const conn = target
      ? await ctx.db
          .query("connections")
          .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", target))
          .first()
      : null;
    const now = Date.now();
    const expiresAt = now + (policy?.approvalTtlHours ?? 72) * 3_600_000;
    const scope = {
      connectionId: conn?.status === "connected" ? conn._id : undefined,
      destination: a.channel,
    };
    const binding = {
      orgId: org._id,
      subjectType: "artifact",
      subjectId: a._id,
      actionKind: target && conn?.status === "connected" ? "publish" : "export",
      contentHash: ver.contentHash,
      scope,
      policyVersion,
      expiresAt,
    };
    await invalidateApprovals(ctx, a._id, "Superseded by a newer decision");
    const approvalId = await ctx.db.insert("approvals", {
      orgId: org._id,
      subjectType: "artifact",
      subjectId: a._id,
      actionKind: binding.actionKind,
      title: a.title,
      contentHash: ver.contentHash,
      scope,
      costEstimateMicros: 0,
      policyVersion,
      approvalHash: await approvalHash(binding),
      status: args.decision === "approve" ? "approved" : "rejected",
      requestedBy: a.createdBy,
      decidedBy: user._id,
      decidedAt: now,
      decisionNote: args.note?.slice(0, 500),
      expiresAt,
      createdAt: now,
    });
    await ctx.db.patch(a._id, { status: args.decision === "approve" ? "approved" : "draft", approvalId, updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `content.${args.decision}d`, subjectType: "artifact", subjectId: a._id, summary: `${args.decision === "approve" ? "Approved" : "Sent back"} "${a.title}" (v${ver.version}).` });
    return approvalId;
  },
});

/**
 * Schedule an approved item. "Scheduled in ClimbOS" is distinct from
 * "Accepted by platform": the provider receipt is recorded only after publishing.
 */
export const schedule = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts"), when: v.number() },
  handler: async (ctx, { slug, artifactId, when }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status !== "approved" && a.status !== "scheduled") throw appError("INVALID", "Approve this before scheduling it.");
    if (when < Date.now() + 60_000) throw appError("INVALID", "Pick a time at least a minute from now.");
    if (when > Date.now() + 90 * 86_400_000) throw appError("INVALID", "Schedule within the next 90 days.");
    await ctx.db.patch(a._id, { status: "scheduled", scheduledFor: when, updatedAt: Date.now() });
    await ctx.scheduler.runAt(when, internal.publish.scheduledPublish, { artifactId, expectedScheduledFor: when });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.scheduled", subjectType: "artifact", subjectId: a._id, summary: `Scheduled "${a.title}" in ClimbOS for ${new Date(when).toISOString()}.` });
  },
});

export const unschedule = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status !== "scheduled") return;
    await ctx.db.patch(a._id, { status: "approved", scheduledFor: undefined, updatedAt: Date.now() });
  },
});

export const publishNow = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    if (a.status !== "approved" && a.status !== "scheduled") throw appError("INVALID", "Approve this first.");
    if (org.emergencyStop?.active) throw appError("PAUSED", "All activity is paused. Resume activity first.");
    await ctx.db.patch(a._id, { status: "publishing", updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.publish.publishArtifact, { artifactId, requestedBy: user._id });
  },
});

export const archive = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    await invalidateApprovals(ctx, a._id, "Archived");
    await ctx.db.patch(a._id, { status: "archived", updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.archived", subjectType: "artifact", subjectId: a._id, summary: `Archived "${a.title}".` });
  },
});

/** Manual export pack for platforms without a verified integration (or when not connected). */
export const exportPack = query({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    if (!ver) return null;
    const imageUrl = ver.imageStorageId ? await ctx.storage.getUrl(ver.imageStorageId) : null;
    const social: DraftPlatform[] = ["instagram", "facebook", "linkedin", "x", "tiktok", "pinterest", "youtube"];
    const platforms = (social as string[]).includes(a.channel) ? [a.channel as DraftPlatform] : (["linkedin", "x", "facebook"] as DraftPlatform[]);
    const pack = buildManualExportPack(
      { title: a.title, text: [ver.headline, ver.body].filter(Boolean).join("\n\n"), hashtags: ver.hashtags, altText: ver.altText, link: ver.destinationUrl, mediaUrls: imageUrl ? [imageUrl] : [] },
      platforms,
    );
    return { pack, csv: manualExportToCsv(pack) };
  },
});

export const markExported = mutation({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const a = assertSameOrg(await ctx.db.get(artifactId), org._id, "draft");
    const now = Date.now();
    await ctx.db.insert("actionReceipts", {
      orgId: org._id,
      artifactId: a._id,
      provider: "manual",
      action: "export",
      idempotencyKey: `${org._id}:export:${a._id}:v${a.currentVersion}`,
      status: "exported",
      summary: "Copied or downloaded for manual posting. ClimbOS can't confirm whether it was posted.",
      createdAt: now,
    });
    await ctx.db.patch(a._id, { status: "exported", updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "content.exported", subjectType: "artifact", subjectId: a._id, summary: `Exported "${a.title}" for manual posting.` });
  },
});

/** Start a content job (social, ads, email, SEO) with a visible cost estimate already shown in the UI. */
export const generate = mutation({
  args: {
    slug: v.string(),
    job: v.union(v.literal("content_social"), v.literal("content_ads"), v.literal("content_email"), v.literal("content_seo")),
    channel: v.optional(channelValidator),
    quantity: v.optional(v.number()),
    images: v.optional(v.number()),
    brief: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const plan = planJob(args.job, { quantity: args.quantity, images: args.images });
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: plan.kind,
      title: plan.title,
      roles: plan.roles,
      input: { channel: args.channel, quantity: args.quantity, images: args.images },
      steps: plan.steps,
      meters: plan.meters,
      createdBy: user._id,
      isFixture: org.kind === "demo",
    });
    await ctx.scheduler.runAfter(0, internal.jobs.createContent, {
      runId,
      job: args.job,
      channel: args.channel,
      quantity: args.quantity,
      images: args.images,
      brief: args.brief?.slice(0, 1500),
    });
    return { runId };
  },
});

export const estimate = query({
  args: {
    slug: v.string(),
    job: v.union(v.literal("content_social"), v.literal("content_ads"), v.literal("content_email"), v.literal("content_seo")),
    quantity: v.optional(v.number()),
    images: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, { slug: args.slug }, "view");
    const plan = planJob(args.job, { quantity: args.quantity, images: args.images });
    return { title: plan.title, roles: plan.roles, maxCostMicros: estimateJobMicros(plan), meters: plan.meters };
  },
});

export const runStatus = query({
  args: { slug: v.string(), runId: v.id("workflowRuns") },
  handler: async (ctx, { slug, runId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const run = assertSameOrg(await ctx.db.get(runId), org._id, "job");
    const steps = await ctx.db
      .query("workflowSteps")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .take(30);
    return {
      id: run._id,
      title: run.title,
      status: run.status,
      roles: run.roles,
      userMessage: run.userMessage ?? null,
      estimateMicros: run.estimateMicros,
      actualMicros: run.actualMicros,
      isFixture: run.isFixture,
      steps: steps.map((s) => ({ label: s.label, status: s.status, role: s.role ?? null, kind: s.kind })),
    };
  },
});
