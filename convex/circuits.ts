import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
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

export const recordProviderResult = internalMutation({
  args: { provider: v.string(), ok: v.boolean() },
  handler: async (ctx, { provider, ok }) => {
    const fleet = await ensureFleet(ctx);
    const circuits = fleet.circuits.filter((c) => c.provider !== provider);
    const prev = fleet.circuits.find((c) => c.provider === provider) ?? { provider, state: "closed" as const, failures: 0 };
    const failures = ok ? 0 : prev.failures + 1;
    const state = ok ? ("closed" as const) : failures >= FAILURE_THRESHOLD ? ("open" as const) : prev.state === "open" ? ("open" as const) : ("closed" as const);
    circuits.push({ provider, state, failures, openedAt: state === "open" ? (prev.state === "open" ? prev.openedAt : Date.now()) : undefined });
    await ctx.db.patch(fleet._id, { circuits, updatedAt: Date.now() });
  },
});
