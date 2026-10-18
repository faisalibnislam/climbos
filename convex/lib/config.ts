import { mergeLiveConfig, type LiveConfig } from "../../shared/economics/liveConfig";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Live settings (admin panel) merged over code defaults. */
export async function getLiveConfig(ctx: QueryCtx | MutationCtx): Promise<LiveConfig> {
  const row = await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q) => q.eq("key", "live"))
    .unique();
  let saved: unknown = null;
  try {
    saved = row ? JSON.parse(row.value) : null;
  } catch {
    saved = null;
  }
  return mergeLiveConfig(saved);
}
