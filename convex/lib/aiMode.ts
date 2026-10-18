import { EXPERT_KINDS, type AiMode } from "../../shared/agents/routes";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { chargeableAccess } from "./access";
import { appError } from "./tenancy";

type Ctx = QueryCtx | MutationCtx;

/** Climb AI Expert is for paid plans; free and trial workspaces use Basic. */
export async function expertUnlocked(ctx: Ctx, org: Doc<"organizations">): Promise<boolean> {
  const access = await chargeableAccess(ctx, org);
  return access.allowed && access.mode === "paid";
}

/** What the picker shows: the default mode and whether Expert can be chosen. */
export async function aiModeView(ctx: Ctx, org: Doc<"organizations">): Promise<{ mode: AiMode; expertUnlocked: boolean }> {
  const unlocked = await expertUnlocked(ctx, org);
  return { mode: unlocked ? (org.aiMode ?? "expert") : "basic", expertUnlocked: unlocked };
}

/**
 * The mode a new job runs in: the owner's choice, else the workspace default
 * (Expert for paid). Choosing Expert without a paid plan is refused; a saved
 * Expert default on a workspace that is no longer paid falls back to Basic.
 */
export async function resolveAiMode(ctx: Ctx, org: Doc<"organizations">, kind: string, requested?: AiMode): Promise<AiMode> {
  if (!EXPERT_KINDS.has(kind) || org.kind === "demo") return "basic";
  const view = await aiModeView(ctx, org);
  if (requested === "expert" && !view.expertUnlocked) throw appError("PAYMENT_REQUIRED", "Climb AI Expert comes with a paid plan. Basic is ready to use.");
  return requested ?? view.mode;
}
