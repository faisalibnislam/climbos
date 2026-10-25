import { sha256Hex } from "../../shared/policy";
import type { Id, Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const ACTIVE_OUTBOUND_STATUSES: Doc<"outboundSends">["status"][] = ["queued", "sending", "uncertain"];

/** True while this workspace has an unresolved owner-started prospect sequence for the address. */
export async function hasActiveOutboundSequence(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  email: string,
  excludingSendId?: Id<"outboundSends">,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const hash = await sha256Hex(normalized);
  const indexed = await Promise.all(ACTIVE_OUTBOUND_STATUSES.map((status) =>
    ctx.db.query("outboundSends").withIndex("by_org_recipient_status", (q) => q.eq("orgId", orgId).eq("recipientHash", hash).eq("status", status)).take(2),
  ));
  if (indexed.some((rows) => rows.some((row) => row._id !== excludingSendId))) return true;

  // Older sends predate recipientHash. Check their original prospect address exactly;
  // if that bounded legacy lookup is ambiguous, conservatively refuse the message.
  const legacyProspects = await ctx.db.query("prospects").withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("publicEmail", email)).take(301);
  if (legacyProspects.length > 300) return true;
  for (const prospect of legacyProspects) {
    const sends = await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id).eq("step", 0)).take(21);
    if (sends.length > 20 || sends.some((send) => send._id !== excludingSendId && ACTIVE_OUTBOUND_STATUSES.includes(send.status))) return true;
  }
  return false;
}

/** A queued public-review invitation is an active customer email flow for that address. */
export async function hasQueuedReviewInvitation(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, email: string): Promise<boolean> {
  return Boolean(await ctx.db.query("reviewRequests").withIndex("by_org_email_status", (q) =>
    q.eq("orgId", orgId).eq("email", email.trim().toLowerCase()).eq("status", "queued"),
  ).first());
}

/** History for one contact hash: last ClimbOS outreach send and whether an outreach sequence is still active. */
export async function outreachHistoryByHash(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, recipientHash: string): Promise<{ activeOutreach: boolean; lastOutreachSentAt?: number }> {
  const active = await Promise.all(ACTIVE_OUTBOUND_STATUSES.map((status) =>
    ctx.db.query("outboundSends").withIndex("by_org_recipient_status", (q) => q.eq("orgId", orgId).eq("recipientHash", recipientHash).eq("status", status)).first(),
  ));
  const sent = await ctx.db.query("outboundSends").withIndex("by_org_recipient_status", (q) => q.eq("orgId", orgId).eq("recipientHash", recipientHash).eq("status", "sent")).take(20);
  const last = sent.reduce((m, row) => Math.max(m, row.sentAt ?? 0), 0);
  return { activeOutreach: active.some(Boolean), ...(last ? { lastOutreachSentAt: last } : {}) };
}
