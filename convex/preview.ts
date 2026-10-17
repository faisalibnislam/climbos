import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { appError, requireOrgAccess } from "./lib/tenancy";

/**
 * Landing-page live preview: an anonymous visitor enters a website and goal,
 * ClimbOS reads the public homepage and drafts three ideas. Strictly bounded:
 * per-IP and global daily caps, cheapest models, one page, no images.
 */

const PER_IP_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
export const PREVIEW_MAX_COST_MICROS = 30_000; // $0.03 reserved per preview
export const DEFAULT_PREVIEW_DAILY_BUDGET_MICROS = 5_000_000; // $5 per day across all visitors

const STEPS = [
  { key: "reading", label: "Reading your website" },
  { key: "understanding", label: "Understanding your business" },
  { key: "planning", label: "Drafting first growth ideas" },
] as const;

function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Called only by the Next.js /api/preview route, which supplies the hashed IP. */
export const startFromServer = mutation({
  args: { serverSecret: v.string(), ipHash: v.string(), website: v.string(), goal: v.string() },
  handler: async (ctx, args) => {
    const expected = process.env.CLIMBOS_SERVER_SECRET;
    if (!expected || !timingSafeEqual(args.serverSecret, expected)) {
      throw appError("FORBIDDEN", "Not allowed.");
    }
    const website = args.website.trim().slice(0, 300);
    const goal = args.goal.trim().slice(0, 300);
    if (!website) throw appError("INVALID", "Please enter your website.");

    const now = Date.now();
    const fleet = await ctx.db
      .query("fleetControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (fleet?.emergencyStop) {
      return { ok: false as const, reason: "unavailable" as const, message: "Live previews are paused right now. Try the demo instead." };
    }

    const recent = await ctx.db
      .query("previews")
      .withIndex("by_ip_created", (q) => q.eq("ipHash", args.ipHash).gt("createdAt", now - DAY_MS))
      .take(PER_IP_PER_DAY + 1);
    if (recent.length >= PER_IP_PER_DAY) {
      return {
        ok: false as const,
        reason: "rate_limited" as const,
        message: "You've used today's free previews. Explore the demo or create a free account to keep going.",
      };
    }

    // Global daily budget across all anonymous previews (bounded scan via index).
    const todays = await ctx.db
      .query("previews")
      .withIndex("by_created", (q) => q.gt("createdAt", now - DAY_MS))
      .take(1000);
    const spent = todays.reduce((s, p) => s + Math.max(p.costMicros, PREVIEW_MAX_COST_MICROS), 0);
    const budget = fleet?.previewDailyBudgetMicros ?? DEFAULT_PREVIEW_DAILY_BUDGET_MICROS;
    if (spent + PREVIEW_MAX_COST_MICROS > budget || todays.length >= 1000) {
      return {
        ok: false as const,
        reason: "rate_limited" as const,
        message: "Lots of people are trying ClimbOS right now. Explore the demo while previews refill.",
      };
    }

    const token = randomToken();
    await ctx.db.insert("previews", {
      token,
      ipHash: args.ipHash,
      website,
      goal: goal || "Get more customers",
      status: "queued",
      steps: STEPS.map((s) => ({ ...s, status: "pending" as const })),
      facts: [],
      ideas: [],
      costMicros: 0,
      createdAt: now,
      expiresAt: now + 7 * DAY_MS,
    });
    await ctx.scheduler.runAfter(0, internal.previewRunner.run, { token });
    return { ok: true as const, token };
  },
});

/** Public, token-scoped read. The token is unguessable (144 bits). */
export const get = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const p = await ctx.db
      .query("previews")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!p || p.expiresAt < Date.now()) return null;
    return {
      status: p.status,
      website: p.website,
      goal: p.goal,
      steps: p.steps,
      business: p.business ?? null,
      facts: p.facts,
      ideas: p.ideas,
      error: p.error ?? null,
      claimed: Boolean(p.claimedByOrgId),
    };
  },
});

export const getInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) =>
    ctx.db
      .query("previews")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique(),
});

export const update = internalMutation({
  args: {
    token: v.string(),
    patch: v.object({
      status: v.optional(
        v.union(
          v.literal("queued"),
          v.literal("reading"),
          v.literal("understanding"),
          v.literal("planning"),
          v.literal("done"),
          v.literal("failed"),
        ),
      ),
      stepKey: v.optional(v.string()),
      stepStatus: v.optional(
        v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("failed")),
      ),
      business: v.optional(
        v.object({ name: v.string(), summary: v.string(), audience: v.string(), category: v.string() }),
      ),
      facts: v.optional(
        v.array(v.object({ statement: v.string(), sourceUrl: v.optional(v.string()), confidence: v.string() })),
      ),
      ideas: v.optional(
        v.array(
          v.object({ title: v.string(), channel: v.string(), why: v.string(), firstStep: v.string(), role: v.string() }),
        ),
      ),
      error: v.optional(v.string()),
      addCostMicros: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { token, patch }) => {
    const p = await ctx.db
      .query("previews")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!p) return;
    const steps = patch.stepKey
      ? p.steps.map((s) => (s.key === patch.stepKey ? { ...s, status: patch.stepStatus ?? s.status } : s))
      : p.steps;
    await ctx.db.patch(p._id, {
      ...(patch.status ? { status: patch.status } : {}),
      steps,
      ...(patch.business ? { business: patch.business } : {}),
      ...(patch.facts ? { facts: patch.facts.slice(0, 8) } : {}),
      ...(patch.ideas ? { ideas: patch.ideas.slice(0, 3) } : {}),
      ...(patch.error ? { error: patch.error } : {}),
      costMicros: p.costMicros + (patch.addCostMicros ?? 0),
    });
  },
});

/** After sign-up, import a preview into the new workspace (facts become needs-review). */
export const claim = mutation({
  args: { token: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, { token, orgId }) => {
    const access = await requireOrgAccess(ctx, { orgId }, "edit");
    const p = await ctx.db
      .query("previews")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!p || p.status !== "done" || p.claimedByOrgId) return { imported: 0 };
    await ctx.db.patch(p._id, { claimedByOrgId: access.org._id });
    return { imported: p.facts.length, website: p.website, goal: p.goal };
  },
});

export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query("previews")
      .withIndex("by_created", (q) => q.lt("createdAt", Date.now() - 30 * DAY_MS))
      .take(200);
    for (const p of old) await ctx.db.delete(p._id);
    return old.length;
  },
});
