import { BUILT_IN_ROUTE, isModelKey, modelAvailable, MODEL_TIERS, userRoute, type ModelRoute, type ModelTier } from "../../shared/ai/modelChoice";
import type { ModelKey } from "../../shared/economics/rates";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./tenancy";

type Ctx = QueryCtx | MutationCtx;

/**
 * Server side of admin-controlled model choice (shared/ai/modelChoice.ts).
 * Model choice is off for every user until an operator enables it for that
 * user; everyone else always runs on the operator defaults.
 */

/** Operator defaults per tier as saved (unvalidated). */
export async function savedModelDefaults(ctx: Ctx): Promise<Doc<"aiModelSettings"> | null> {
  return ctx.db.query("aiModelSettings").withIndex("by_key", (q) => q.eq("key", "global")).unique();
}

/**
 * The route every run uses unless a permitted user chose a model. A saved
 * default whose provider key has since been removed falls back to the
 * built-in OpenAI model for that tier, so a missing key never fails a run.
 */
export async function defaultModelRoute(ctx: Ctx): Promise<ModelRoute> {
  const row = await savedModelDefaults(ctx);
  const pick = (tier: ModelTier): ModelKey => {
    const saved = row?.[tier];
    return saved && isModelKey(saved) && modelAvailable(saved) ? saved : BUILT_IN_ROUTE[tier];
  };
  return { standard: pick("standard"), advanced: pick("advanced"), source: "default" };
}

export async function canChooseModel(ctx: Ctx, userId: Id<"users"> | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const grant = await ctx.db.query("aiModelGrants").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  return grant?.enabled === true;
}

/**
 * The route for a run started by `userId`. A requested model is honoured only
 * for a user an operator enabled, and only when its provider key is set;
 * anyone else passing a model is refused (the selector is never shown to them).
 */
export async function resolveModelRoute(ctx: Ctx, userId: Id<"users"> | null | undefined, requested: string | undefined): Promise<ModelRoute> {
  if (!requested) return defaultModelRoute(ctx);
  if (!(await canChooseModel(ctx, userId))) throw appError("FORBIDDEN", "Model choice isn't enabled for your account.");
  if (!isModelKey(requested)) throw appError("INVALID", "That model isn't available.");
  if (!modelAvailable(requested)) throw appError("INVALID", "That model's provider isn't connected yet. Choose another model.");
  return userRoute(requested);
}

export function assertTier(tier: string): asserts tier is ModelTier {
  if (!(MODEL_TIERS as readonly string[]).includes(tier)) throw appError("INVALID", "Unknown model tier.");
}
