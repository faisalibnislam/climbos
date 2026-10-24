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

/** Whole curated catalog with honest source, check, cadence, and access-review states. */
export const catalog = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "read");
    const now = Date.now();
    const rows = await ctx.db.query("growthKnowledgeSources").take(500);
    const byRegistry = new Map(rows.map((row) => [row.registryId, row]));
    return registry.sources.map((registered) => {
      const source = byRegistry.get(registered.registry_id);
      const defaultCadence = sourceFreshness(registered, now).cadenceDays ?? 0;
      const cadenceDays = source?.reviewCadenceDays ?? defaultCadence;
      const freshnessState = !source || source.status === "not_checked"
        ? "not_checked"
        : source.status === "update_pending" || source.status === "queued" || source.status === "checking" || source.status === "failed" || source.status === "blocked_by_robots"
          ? source.status
          : cadenceDays === 0
            ? "manual_only"
            : source.nextCheckAt !== undefined && source.nextCheckAt <= now
              ? "recheck_due"
              : "scheduled";
      return {
        registryId: registered.registry_id,
        url: registered.url,
        title: registered.title,
        publicationDate: registered.publication_date ?? null,
        registryRetrievedAt: registered.retrieved_at,
        books: registered.books,
        claimScopes: registered.records.map((record) => record.claim_scope),
        verificationStatuses: [...new Set(registered.records.map((record) => record.verification_status))],
        status: source?.status ?? "not_checked",
        freshnessState,
        accessReview: source?.accessReview ?? "not_reviewed",
        checkedAt: source?.checkedAt ?? null,
        nextCheckAt: source?.nextCheckAt ?? null,
        reviewCadenceDays: cadenceDays,
        cadenceUpdatedAt: source?.cadenceUpdatedAt ?? null,
        lastError: source?.lastError ?? null,
        contentHash: source?.contentHash ?? null,
        version: source?.version ?? 0,
      };
    });
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
    const defaultCadence = sourceFreshness(registered, now).cadenceDays ?? 0;
    const sourceId = existing
      ? existing._id
      : await ctx.db.insert("growthKnowledgeSources", {
        registryId, url: registered.url, title: registered.title, status: "queued", accessReview: "not_reviewed", requestedBy: user._id,
        requestedAt: now, reviewCadenceDays: defaultCadence, version: 0,
      });
    await ctx.db.patch(sourceId, { status: "queued", url: registered.url, title: registered.title, requestedBy: user._id, requestedAt: now, reviewCadenceDays: existing?.reviewCadenceDays ?? defaultCadence, lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.knowledgeActions.refreshSource, { sourceId });
    return sourceId;
  },
});

/** Staff-set recheck interval. Zero means manual checks only, not an assertion that a source is fresh. */
export const setCadence = mutation({
  args: { registryId: v.string(), days: v.number() },
  handler: async (ctx, { registryId, days }) => {
    const { user } = await requireStaff(ctx, "features");
    if (![0, 7, 14, 30, 60, 90, 180, 365].includes(days)) throw appError("INVALID", "Choose an available review interval.");
    const registered = registry.sources.find((source) => source.registry_id === registryId);
    if (!registered) throw appError("INVALID", "Choose a source from the registry.");
    const existing = await ctx.db.query("growthKnowledgeSources").withIndex("by_registry_id", (q) => q.eq("registryId", registryId)).first();
    const now = Date.now();
    const nextCheckAt = days > 0 && existing?.checkedAt !== undefined ? existing.checkedAt + days * 24 * 60 * 60 * 1000 : undefined;
    const fields = { reviewCadenceDays: days, cadenceUpdatedBy: user._id, cadenceUpdatedAt: now, nextCheckAt };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("growthKnowledgeSources", {
      registryId, url: registered.url, title: registered.title, status: "not_checked", accessReview: "not_reviewed", version: 0, ...fields,
    });
    return { days, nextCheckAt: nextCheckAt ?? null };
  },
});

export const dismissProposal = mutation({
  args: { proposalId: v.id("growthKnowledgeProposals") },
  handler: async (ctx, { proposalId }) => {
    const { user } = await requireStaff(ctx, "features");
    const proposal = await ctx.db.get(proposalId);
    if (!proposal || proposal.status !== "pending_review") throw appError("NOT_FOUND", "Pending proposal not found.");
    const now = Date.now();
    await ctx.db.patch(proposalId, { status: "dismissed", reviewedBy: user._id, reviewedAt: now });
    const source = await ctx.db.get(proposal.sourceId);
    if (source?.status === "update_pending" && source.version === proposal.version) {
      const cadence = source.reviewCadenceDays ?? 0;
      await ctx.db.patch(source._id, {
        status: "unchanged",
        nextCheckAt: cadence > 0 ? now + cadence * 24 * 60 * 60 * 1000 : undefined,
      });
    }
    return true;
  },
});

export const refreshContext = internalMutation({
  args: { sourceId: v.id("growthKnowledgeSources") },
  handler: async (ctx, { sourceId }) => ctx.db.get(sourceId),
});

export const markChecking = internalMutation({
  args: { sourceId: v.id("growthKnowledgeSources"), scheduled: v.optional(v.boolean()) },
  handler: async (ctx, { sourceId, scheduled }) => {
    const source = await ctx.db.get(sourceId);
    if (!source || source.status !== "queued" || (scheduled && source.reviewCadenceDays === 0)) return null;
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
      if (!freshness.directPageRead || source.reviewCadenceDays === 0) continue;
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
    if (!registered || !sourceFreshness(registered, now).directPageRead || source.reviewCadenceDays === 0) return null;
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
    const nextCheckAt = source.reviewCadenceDays === undefined
      ? a.nextCheckAt
      : source.reviewCadenceDays > 0
        ? a.checkedAt + source.reviewCadenceDays * 24 * 60 * 60 * 1000
        : undefined;
    await ctx.db.patch(a.sourceId, {
      status: a.status, checkedAt: a.checkedAt, nextCheckAt,
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
