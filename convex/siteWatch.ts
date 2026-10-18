import { v } from "convex/values";
import { CALL_ROUTES } from "../shared/agents/routes";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { audit } from "./lib/audit";
import { notifyOwners } from "./lib/notify";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Self-improvement loop 1 — keep researching each business. Weekly, ClimbOS
 * re-reads the owner's own site (free); when offers, prices or products
 * really change, Luna proposes updated facts for the owner to confirm.
 * Confirmed facts feed every plan, draft, page and chat answer.
 */

const MODEL = CALL_ROUTES.chat_intent;
const DAY = 86_400_000;

/* ---------------- Business facts page ---------------- */

export const facts = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) return null;
    const rows = (await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", business._id)).take(300)).filter((f) => f.reviewState !== "rejected");
    const order = { needs_review: 0, edited: 1, confirmed: 1, rejected: 2 } as const;
    rows.sort((a, b) => order[a.reviewState] - order[b.reviewState] || b.updatedAt - a.updatedAt);
    return {
      website: business.website ?? null,
      siteCheckedAt: business.siteCheckedAt ?? null,
      facts: rows.map((f) => ({ id: f._id, category: f.category, statement: f.statement, state: f.reviewState, provenance: f.provenance, replaces: f.replacesFactId ?? null })),
    };
  },
});

/** Confirming a proposed update retires the fact it replaces. */
export const confirmUpdate = mutation({
  args: { slug: v.string(), factId: v.id("businessFacts") },
  handler: async (ctx, { slug, factId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const f = assertSameOrg(await ctx.db.get(factId), org._id, "fact");
    const now = Date.now();
    await ctx.db.patch(f._id, { reviewState: "confirmed", updatedBy: user._id, updatedAt: now });
    if (f.replacesFactId) {
      const old = await ctx.db.get(f.replacesFactId);
      if (old && old.orgId === org._id) await ctx.db.patch(old._id, { reviewState: "rejected", updatedBy: user._id, updatedAt: now });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "fact.confirm", subjectType: "fact", subjectId: f._id, summary: "Fact confirmed." });
  },
});

export const checkNow = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const b = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!b?.website) throw appError("INVALID", "Add your website first.");
    if (b.siteCheckedAt && Date.now() - b.siteCheckedAt < 6 * 3_600_000) throw appError("RATE_LIMITED", "Checked in the last 6 hours.");
    await ctx.scheduler.runAfter(0, internal.siteWatchActions.check, { orgId: org._id });
  },
});

/* ---------------- weekly job plumbing ---------------- */

export const targets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: Id<"organizations">[] = [];
    const since = Date.now() - 45 * DAY;
    for (const o of await ctx.db.query("organizations").withIndex("by_kind_created", (q) => q.eq("kind", "customer")).take(3000)) {
      if (o.deletedAt || o.suspendedAt) continue;
      // Only workspaces in use: someone ran a job in the last 45 days.
      const recent = await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", o._id).gte("createdAt", since)).first();
      if (recent) out.push(o._id);
    }
    return out;
  },
});

export const siteState = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const b = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first();
    if (!b?.website) return null;
    const facts = (await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", b._id)).take(200)).filter((f) => f.reviewState === "confirmed" || f.reviewState === "edited");
    return { businessId: b._id, website: b.website, siteHash: b.siteHash ?? null, siteText: b.siteText ?? null, name: b.name, facts: facts.map((f) => ({ id: f._id as string, category: f.category, statement: f.statement })) };
  },
});

export const saveSite = internalMutation({
  args: { businessId: v.id("businesses"), hash: v.string(), text: v.string() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.businessId, { siteHash: a.hash, siteText: a.text.slice(0, 60_000), siteCheckedAt: Date.now() });
  },
});

export const startRun = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<Id<"workflowRuns"> | null> => {
    const org = await ctx.db.get(orgId);
    if (!org) return null;
    try {
      return await createRunWithReservation(ctx, { org, kind: "site_watch", title: "Your website changed: updating facts", roles: ["data_analyst"], input: {}, steps: [{ kind: "model", role: "data_analyst", modelKey: MODEL, inputBudget: 8_000, outputBudget: 1_500 }], meters: {}, isFixture: org.kind === "demo" });
    } catch {
      return null;
    }
  },
});

export const proposeFacts = internalMutation({
  args: { orgId: v.id("organizations"), businessId: v.id("businesses"), facts: v.array(v.object({ category: v.string(), statement: v.string(), replaces: v.optional(v.string()) })) },
  handler: async (ctx, { orgId, businessId, facts }) => {
    const now = Date.now();
    const cats = ["product", "audience", "pricing", "brand", "offer", "proof", "competitor", "other"] as const;
    let n = 0;
    for (const f of facts.slice(0, 8)) {
      const category = (cats as readonly string[]).includes(f.category) ? (f.category as Doc<"businessFacts">["category"]) : "other";
      const replaces = f.replaces ? ctx.db.normalizeId("businessFacts", f.replaces) : null;
      const old = replaces ? await ctx.db.get(replaces) : null;
      await ctx.db.insert("businessFacts", { orgId, businessId, category, statement: f.statement.slice(0, 400), confidence: "medium", reviewState: "needs_review", provenance: "researched", sourceIds: [], replacesFactId: old && old.orgId === orgId ? old._id : undefined, createdAt: now, updatedAt: now });
      n++;
    }
    if (n) await notifyOwners(ctx, orgId, `Your website changed: ${n} fact${n === 1 ? "" : "s"} to confirm so plans and replies stay accurate.`, "settings/facts");
    return n;
  },
});
