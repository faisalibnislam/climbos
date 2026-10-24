import { v } from "convex/values";
import registry from "../docs/growth-intelligence/source_registry.json";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { appError } from "./lib/tenancy";
import { requireStaff } from "./lib/staff";
import { sourceFreshness } from "../shared/knowledge/freshness";

/** Staff-only source freshness controls. A detected change is evidence to review, never an update. */
export const listSources = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "read");
    return (await ctx.db.query("growthKnowledgeSources").withIndex("by_status_requested").order("desc").take(200))
      .map(({ _id, registryId, url, title, status, accessReview, requestedAt, checkedAt, nextCheckAt, version, lastError }) => ({
        id: _id, registryId, url, title, status, accessReview, requestedAt, checkedAt: checkedAt ?? null,
        nextCheckAt: nextCheckAt ?? null, version, lastError: lastError ?? null,
      }));
  },
});

export const listProposals = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "read");
    return (await ctx.db.query("growthKnowledgeProposals").withIndex("by_status_created", (q) => q.eq("status", "pending_review")).order("desc").take(100));
  },
});

export const requestRefresh = mutation({
  args: { registryId: v.string() },
  handler: async (ctx, { registryId }) => {
    const { user } = await requireStaff(ctx, "features");
    const registered = registry.sources.find((source) => source.registry_id === registryId);
    if (!registered) throw appError("INVALID", "Choose a source from the source registry.");
    const existing = await ctx.db.query("growthKnowledgeSources").withIndex("by_registry_id", (q) => q.eq("registryId", registryId)).first();
    if (existing && (existing.status === "queued" || existing.status === "checking")) throw appError("INVALID", "A check for this source is already queued or running.");
    const pending = existing && await ctx.db.query("growthKnowledgeProposals").withIndex("by_source_version", (q) => q.eq("sourceId", existing._id)).order("desc").first();
    if (pending?.status === "pending_review") throw appError("INVALID", "Review the pending source change before checking it again.");
    const now = Date.now();
    const sourceId = existing
      ? existing._id
      : await ctx.db.insert("growthKnowledgeSources", {
        registryId, url: registered.url, title: registered.title, status: "queued", accessReview: "not_reviewed", requestedBy: user._id,
        requestedAt: now, version: 0,
      });
    await ctx.db.patch(sourceId, { status: "queued", url: registered.url, title: registered.title, requestedBy: user._id, requestedAt: now, lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.knowledgeActions.refreshSource, { sourceId });
    return sourceId;
  },
});

export const dismissProposal = mutation({
  args: { proposalId: v.id("growthKnowledgeProposals") },
  handler: async (ctx, { proposalId }) => {
    const { user } = await requireStaff(ctx, "features");
    const proposal = await ctx.db.get(proposalId);
    if (!proposal || proposal.status !== "pending_review") throw appError("NOT_FOUND", "Pending proposal not found.");
    await ctx.db.patch(proposalId, { status: "dismissed", reviewedBy: user._id, reviewedAt: Date.now() });
    return true;
  },
});

export const refreshContext = internalMutation({
  args: { sourceId: v.id("growthKnowledgeSources") },
  handler: async (ctx, { sourceId }) => ctx.db.get(sourceId),
});

export const markChecking = internalMutation({
  args: { sourceId: v.id("growthKnowledgeSources") },
  handler: async (ctx, { sourceId }) => {
    const source = await ctx.db.get(sourceId);
    if (!source || source.status !== "queued") return null;
    await ctx.db.patch(sourceId, { status: "checking" });
    return source;
  },
});

/** Bounded queue of previously fetched, registry-eligible sources whose recheck is due. */
export const dueRefreshes = internalQuery({
  args: { now: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { now, limit }) => {
    const take = Math.max(1, Math.min(10, Math.floor(limit ?? 5)));
    const candidates = (await Promise.all(
      (["baseline_set", "unchanged"] as const).map((status) =>
        ctx.db.query("growthKnowledgeSources")
          .withIndex("by_status_next_check", (q) => q.eq("status", status).lte("nextCheckAt", now))
          .take(take),
      ),
    )).flat().sort((a, b) => (a.nextCheckAt ?? 0) - (b.nextCheckAt ?? 0) || a._id.localeCompare(b._id));
    const due = [];
    for (const source of candidates) {
      const registered = registry.sources.find((item) => item.registry_id === source.registryId);
      if (!registered || source.nextCheckAt === undefined || source.nextCheckAt > now) continue;
      const freshness = sourceFreshness(registered, now);
      if (freshness.status !== "recheck_due" || !freshness.directPageRead) continue;
      due.push(source._id);
      if (due.length >= take) break;
    }
    return due;
  },
});

/** Atomically claims one due source and prevents duplicate cron dispatch. */
export const queueDueRefresh = internalMutation({
  args: { sourceId: v.id("growthKnowledgeSources"), now: v.number() },
  handler: async (ctx, { sourceId, now }) => {
    const source = await ctx.db.get(sourceId);
    if (!source || !["baseline_set", "unchanged"].includes(source.status) || source.nextCheckAt === undefined || source.nextCheckAt > now) return null;
    const pending = await ctx.db.query("growthKnowledgeProposals")
      .withIndex("by_source_version", (q) => q.eq("sourceId", sourceId))
      .order("desc")
      .first();
    if (pending?.status === "pending_review") return null;
    const registered = registry.sources.find((item) => item.registry_id === source.registryId);
    if (!registered || sourceFreshness(registered, now).status !== "recheck_due") return null;
    await ctx.db.patch(sourceId, { status: "queued", requestedAt: now, lastError: undefined });
    return sourceId;
  },
});

export const finishRefresh = internalMutation({
  args: {
    sourceId: v.id("growthKnowledgeSources"),
    status: v.union(v.literal("baseline_set"), v.literal("unchanged"), v.literal("update_pending"), v.literal("blocked_by_robots"), v.literal("failed")),
    checkedAt: v.number(),
    nextCheckAt: v.optional(v.number()),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    contentText: v.optional(v.string()),
    lastError: v.optional(v.string()),
    proposal: v.optional(v.object({ previousHash: v.string(), currentHash: v.string(), removedPassages: v.array(v.string()), addedPassages: v.array(v.string()), claimScopes: v.array(v.string()) })),
    source: v.optional(v.object({ url: v.string(), title: v.string() })),
  },
  handler: async (ctx, a) => {
    const source = await ctx.db.get(a.sourceId);
    if (!source) return false;
    const version = a.proposal ? source.version + 1 : source.version;
    await ctx.db.patch(a.sourceId, {
      status: a.status, checkedAt: a.checkedAt, nextCheckAt: a.nextCheckAt,
      etag: a.etag ?? source.etag, lastModified: a.lastModified ?? source.lastModified,
      contentHash: a.contentHash ?? source.contentHash, contentText: a.contentText ?? source.contentText,
      lastError: a.lastError, version, ...(a.source ?? {}),
    });
    if (a.proposal) await ctx.db.insert("growthKnowledgeProposals", {
      sourceId: a.sourceId, registryId: source.registryId, url: a.source?.url ?? source.url, title: a.source?.title ?? source.title,
      version, ...a.proposal, applicability: "unreviewed", affectedRules: "unassessed",
      rationale: "Source content changed; human review required.", evaluationImpact: "not_run; production guidance unchanged",
      status: "pending_review", createdAt: a.checkedAt,
    });
    return true;
  },
});
