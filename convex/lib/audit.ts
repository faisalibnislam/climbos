import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Append-only audit trail. Never include secrets, tokens or raw contact lists. */
export async function audit(
  ctx: MutationCtx,
  event: {
    orgId?: Id<"organizations">;
    actorType: "user" | "system" | "operator" | "agent";
    actorId?: string;
    action: string;
    subjectType?: string;
    subjectId?: string;
    summary: string;
  },
): Promise<void> {
  await ctx.db.insert("auditEvents", { ...event, summary: event.summary.slice(0, 500), createdAt: Date.now() });
}
