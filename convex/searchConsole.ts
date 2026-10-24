import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrgAccess } from "./lib/tenancy";

const rowValidator = v.object({
  query: v.string(),
  page: v.string(),
  clicks: v.number(),
  impressions: v.number(),
  ctr: v.number(),
  position: v.number(),
});

export const startSnapshot = internalMutation({
  args: {
    orgId: v.id("organizations"),
    connectionId: v.id("connections"),
    property: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => ctx.db.insert("searchConsoleSnapshots", {
    ...args,
    dataState: "final",
    status: "syncing",
    rowCount: 0,
    truncated: false,
    fetchedAt: Date.now(),
  }),
});

export const writeSnapshotRows = internalMutation({
  args: { snapshotId: v.id("searchConsoleSnapshots"), rows: v.array(rowValidator) },
  handler: async (ctx, { snapshotId, rows }) => {
    const snapshot = await ctx.db.get(snapshotId);
    if (!snapshot || snapshot.status !== "syncing") return 0;
    for (const row of rows.slice(0, 250)) await ctx.db.insert("searchConsoleRows", { ...row, orgId: snapshot.orgId, snapshotId });
    return Math.min(rows.length, 250);
  },
});

export const finishSnapshot = internalMutation({
  args: { snapshotId: v.id("searchConsoleSnapshots"), status: v.union(v.literal("complete"), v.literal("failed")), rowCount: v.number(), truncated: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot || snapshot.status !== "syncing") return;
    await ctx.db.patch(snapshot._id, { status: args.status, rowCount: args.rowCount, truncated: args.truncated, error: args.error?.slice(0, 300) });
    if (args.status !== "complete") {
      await ctx.scheduler.runAfter(0, internal.searchConsole.cleanupSnapshot, { snapshotId: snapshot._id });
      return;
    }
    const recent = await ctx.db.query("searchConsoleSnapshots").withIndex("by_org_fetched", (q) => q.eq("orgId", snapshot.orgId)).order("desc").take(20);
    for (const old of recent.filter((row) => row.status === "complete").slice(3)) {
      await ctx.scheduler.runAfter(0, internal.searchConsole.cleanupSnapshot, { snapshotId: old._id });
    }
  },
});

export const cleanupSnapshot = internalMutation({
  args: { snapshotId: v.id("searchConsoleSnapshots") },
  handler: async (ctx, { snapshotId }) => {
    const rows = await ctx.db.query("searchConsoleRows").withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshotId)).take(250);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length < 250) await ctx.db.delete(snapshotId);
    else await ctx.scheduler.runAfter(0, internal.searchConsole.cleanupSnapshot, { snapshotId });
  },
});

async function latestSnapshot(ctx: QueryCtx, orgId: Id<"organizations">): Promise<{ snapshot: Doc<"searchConsoleSnapshots">; rows: Doc<"searchConsoleRows">[] } | null> {
  const snapshots = await ctx.db.query("searchConsoleSnapshots").withIndex("by_org_fetched", (q) => q.eq("orgId", orgId)).order("desc").take(20);
  const snapshot = snapshots.find((item) => item.status === "complete");
  if (!snapshot) return null;
  const rows = await ctx.db.query("searchConsoleRows").withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshot._id)).take(2_000);
  return { snapshot, rows };
}

export const latestForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const result = await latestSnapshot(ctx, orgId);
    return result ? { ...result.snapshot, rows: result.rows } : null;
  },
});

export const observations = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const result = await latestSnapshot(ctx, org._id);
    if (!result) return null;
    return {
      property: result.snapshot.property,
      startDate: result.snapshot.startDate,
      endDate: result.snapshot.endDate,
      fetchedAt: result.snapshot.fetchedAt,
      dataState: result.snapshot.dataState,
      rowCount: result.snapshot.rowCount,
      truncated: result.snapshot.truncated,
      rows: result.rows.map(({ _id: _rowId, _creationTime: _createdAt, orgId: _orgId, snapshotId: _snapshotId, ...row }) => row),
      note: "These are Search Console observations for this property and date window. They are not universal search volume, complete query coverage, or proof of causation.",
    };
  },
});

/** Recent completed rolling-window snapshots retained for owner review. */
export const history = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const snapshots = await ctx.db.query("searchConsoleSnapshots")
      .withIndex("by_org_fetched", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(20);
    return snapshots.filter((item) => item.status === "complete").slice(0, 3).map((item) => ({
      id: item._id,
      property: item.property,
      startDate: item.startDate,
      endDate: item.endDate,
      fetchedAt: item.fetchedAt,
      rowCount: item.rowCount,
      truncated: item.truncated,
      dataState: item.dataState,
    }));
  },
});

/** Tenant-scoped details for one retained snapshot in the owner-visible history. */
export const snapshot = query({
  args: { slug: v.string(), snapshotId: v.id("searchConsoleSnapshots") },
  handler: async (ctx, { slug, snapshotId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const snapshot = await ctx.db.get(snapshotId);
    if (!snapshot || snapshot.orgId !== org._id || snapshot.status !== "complete") return null;
    const rows = await ctx.db.query("searchConsoleRows").withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshot._id)).take(2_000);
    return {
      id: snapshot._id,
      property: snapshot.property,
      startDate: snapshot.startDate,
      endDate: snapshot.endDate,
      fetchedAt: snapshot.fetchedAt,
      dataState: snapshot.dataState,
      rowCount: snapshot.rowCount,
      truncated: snapshot.truncated,
      rows: rows.map(({ _id: _rowId, _creationTime: _createdAt, orgId: _orgId, snapshotId: _snapshotId, ...row }) => row),
    };
  },
});
