import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { providerDownEmail } from "./lib/emailTemplates";
import { operatorEmails } from "./lib/tenancy";
import { DEFAULT_PREVIEW_DAILY_BUDGET_MICROS } from "./preview";

/** Provider circuit breakers: open after 5 consecutive failures, half-open after 60s. */
const FAILURE_THRESHOLD = 5;
const OPEN_MS = 60_000;

export async function ensureFleet(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("fleetControls")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("fleetControls", {
    key: "global",
    emergencyStop: false,
    circuits: [],
    previewDailyBudgetMicros: DEFAULT_PREVIEW_DAILY_BUDGET_MICROS,
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}

export const circuitState = internalQuery({
  args: { provider: v.string() },
  handler: async (ctx, { provider }) => {
    const fleet = await ctx.db
      .query("fleetControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const c = fleet?.circuits.find((x) => x.provider === provider);
    if (!c || c.state === "closed") return "closed" as const;
    if (c.state === "open" && c.openedAt && Date.now() - c.openedAt > OPEN_MS) return "half_open" as const;
    return c.state;
  },
});

const ALERT_EVERY_MS = 6 * 60 * 60_000;

/**
 * Record one provider call. `billing` failures (out of credit, spend limit)
 * open the circuit at once: retrying won't help until the account is topped up.
 * Opening a circuit emails the operators (at most every 6 hours).
 */
export const recordProviderResult = internalMutation({
  args: { provider: v.string(), ok: v.boolean(), billing: v.optional(v.boolean()), reason: v.optional(v.string()) },
  handler: async (ctx, { provider, ok, billing, reason }) => {
    const fleet = await ensureFleet(ctx);
    const prev = fleet.circuits.find((c) => c.provider === provider) ?? { provider, state: "closed" as const, failures: 0 };
    if (ok && prev.state === "closed" && prev.failures === 0) return; // hot path: nothing to change
    const circuits = fleet.circuits.filter((c) => c.provider !== provider);
    const failures = ok ? 0 : billing ? Math.max(prev.failures + 1, FAILURE_THRESHOLD) : prev.failures + 1;
    const state = ok ? ("closed" as const) : failures >= FAILURE_THRESHOLD ? ("open" as const) : prev.state === "open" ? ("open" as const) : ("closed" as const);
    const now = Date.now();
    const opening = state === "open" && prev.state !== "open";
    const alert = opening && (!("alertedAt" in prev) || !prev.alertedAt || now - prev.alertedAt > ALERT_EVERY_MS);
    const why = reason ?? (billing ? "billing" : "repeated errors");
    circuits.push({
      provider,
      state,
      failures,
      openedAt: state === "open" ? (prev.state === "open" ? prev.openedAt : now) : undefined,
      alertedAt: alert ? now : "alertedAt" in prev ? prev.alertedAt : undefined,
      reason: state === "open" ? why : undefined,
    });
    await ctx.db.patch(fleet._id, { circuits, updatedAt: now });
    if (alert) await ctx.scheduler.runAfter(0, internal.circuits.alertOps, { provider, reason: why });
  },
});

export const alertOps = internalAction({
  args: { provider: v.string(), reason: v.string() },
  handler: async (ctx, { provider, reason }) => {
    const mail = providerDownEmail({ provider, reason, url: `${process.env.SITE_URL ?? "https://climbos.app"}/ops` });
    for (const to of operatorEmails()) {
      await ctx.runAction(internal.notifications.sendPlatformEmail, { to, template: "ops_provider_down", ...mail });
    }
  },
});
