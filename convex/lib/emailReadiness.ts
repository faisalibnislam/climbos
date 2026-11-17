import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { EmailSenderReadiness } from "../../shared/growth/emailReadiness";

export const emailReadinessValidator = v.object({
  domain: v.string(), state: v.union(v.literal("verified"), v.literal("setup_required"), v.literal("unknown")),
  checkedAt: v.number(), message: v.string(), sourceUrl: v.union(v.string(), v.null()),
});

/** Never reuse a report from a disconnected account, rotated key or fixture. */
export async function recordedEmailReadiness(ctx: QueryCtx, connection: Doc<"connections"> | null | undefined): Promise<EmailSenderReadiness | null> {
  if (!connection || connection.provider !== "email_resend" || connection.status !== "connected" || connection.isFixture || !connection.emailSenderReadiness) return null;
  const saved = connection.emailSenderReadiness;
  const key = await ctx.db.query("connectionSecrets").withIndex("by_connection", q => q.eq("connectionId", connection._id)).first();
  if (!key || key.orgId !== connection.orgId || key._id !== saved.credentialId || !Number.isFinite(saved.report.checkedAt) || saved.report.checkedAt > Date.now()) return null;
  return saved.report;
}
