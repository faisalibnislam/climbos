import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { appError, requireUser } from "./lib/tenancy";

const MAX_DRAFTS = 10;
const MAX_PAYLOAD = 12_000;

/** A short, owner-recognisable name for the unfinished business: its name, else the start of what they wrote. */
export function draftLabel(payload: string): string | null {
  let d: { version?: unknown; name?: unknown; nameOverride?: unknown; chat?: unknown; description?: unknown; website?: unknown };
  try {
    d = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!d || d.version !== 1) return null;
  const text = (x: unknown) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : "");
  const name = text(d.nameOverride) || text(d.name);
  const named = /\b(?:called|named)\s+([^.,;!?]{2,60})/i.exec(text(d.chat))?.[1]?.trim();
  const fallback = text(d.website) || text(d.chat) || text(d.description);
  if (!name && !named && !fallback) return "";
  return (name || named || fallback).slice(0, 60);
}

/** Save (or update) the step-one draft for a business that isn't created yet. Empty drafts are not saved. */
export const save = mutation({
  args: { draftId: v.optional(v.id("onboardingDrafts")), payload: v.string() },
  handler: async (ctx, { draftId, payload }): Promise<Id<"onboardingDrafts"> | null> => {
    const user = await requireUser(ctx);
    if (user.isAnonymous) throw appError("FORBIDDEN", "Create a free account to save your setup.");
    if (payload.length > MAX_PAYLOAD) throw appError("INVALID", "This draft is too long to save.");
    const label = draftLabel(payload);
    if (label === null) throw appError("INVALID", "This draft couldn't be read.");
    const now = Date.now();
    if (draftId) {
      const existing = await ctx.db.get(draftId);
      if (!existing || existing.userId !== user._id) throw appError("NOT_FOUND", "That unfinished setup isn't available.");
      if (!label) {
        await ctx.db.delete(draftId);
        return null;
      }
      await ctx.db.patch(draftId, { payload, label, updatedAt: now });
      return draftId;
    }
    if (!label) return null;
    const mine = await ctx.db.query("onboardingDrafts").withIndex("by_user_updated", (q) => q.eq("userId", user._id)).order("asc").take(MAX_DRAFTS + 1);
    // Keep the newest drafts: the oldest is replaced rather than refusing to save.
    if (mine.length >= MAX_DRAFTS) await ctx.db.delete(mine[0]._id);
    return await ctx.db.insert("onboardingDrafts", { userId: user._id, payload, label, createdAt: now, updatedAt: now });
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db.query("onboardingDrafts").withIndex("by_user_updated", (q) => q.eq("userId", userId)).order("desc").take(MAX_DRAFTS);
    return rows.map((r) => ({ id: r._id, label: r.label, updatedAt: r.updatedAt }));
  },
});

export const get = query({
  args: { draftId: v.id("onboardingDrafts") },
  handler: async (ctx, { draftId }) => {
    const userId = await getAuthUserId(ctx);
    const row = userId ? await ctx.db.get(draftId) : null;
    if (!row || row.userId !== userId) return null;
    return { id: row._id, payload: row.payload, label: row.label, updatedAt: row.updatedAt };
  },
});

export const discard = mutation({
  args: { draftId: v.id("onboardingDrafts") },
  handler: async (ctx, { draftId }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(draftId);
    if (row && row.userId === user._id) await ctx.db.delete(draftId);
  },
});
