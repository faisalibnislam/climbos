import { parsePlatformApprovals, type PlatformApprovals } from "../../shared/integrations/platformApprovals";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const PLATFORM_APPROVALS_KEY = "platform_approvals";

/** Provider approval statuses staff recorded in the Console (absent = not submitted). */
export async function getPlatformApprovals(ctx: QueryCtx | MutationCtx): Promise<PlatformApprovals> {
  const row = await ctx.db
    .query("appConfig")
    .withIndex("by_key", (q) => q.eq("key", PLATFORM_APPROVALS_KEY))
    .unique();
  if (!row) return {};
  try {
    return parsePlatformApprovals(JSON.parse(row.value));
  } catch {
    return {};
  }
}
