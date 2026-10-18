import { v } from "convex/values";
import { creditsToMicros, TOPUP_VALID_DAYS } from "../shared/economics";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { accountWorkspaces } from "./lib/accounts";
import { audit } from "./lib/audit";
import { getLiveConfig } from "./lib/config";
import { requireOrgAccess } from "./lib/tenancy";

/**
 * Referrals ("give 200, get 200"): each account has a share link. When a
 * referred account buys its first package, both accounts get credits that
 * last 12 months (amount set live in the admin panel).
 */

function newCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join("");
}

export const mine = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    if (!org.accountId) return null;
    const account = await ctx.db.get(org.accountId);
    const rows = await ctx.db.query("referrals").withIndex("by_referrer", (q) => q.eq("referrerAccountId", org.accountId!)).take(200);
    return {
      code: account?.referralCode ?? null,
      credits: (await getLiveConfig(ctx)).referralCredits,
      signedUp: rows.length,
      rewarded: rows.filter((r) => r.status === "rewarded").length,
      earned: rows.reduce((s, r) => s + (r.status === "rewarded" ? (r.credits ?? 0) : 0), 0),
    };
  },
});

/** Create (once) this account's share code. */
export const ensureCode = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    if (!org.accountId) return null;
    const account = await ctx.db.get(org.accountId);
    if (account?.referralCode) return account.referralCode;
    let code = newCode();
    while (await ctx.db.query("accounts").withIndex("by_referral_code", (q) => q.eq("referralCode", code)).first()) code = newCode();
    await ctx.db.patch(org.accountId, { referralCode: code });
    return code;
  },
});

/** Link a new account to the account whose code brought it (once; never to itself). */
export async function recordReferral(ctx: MutationCtx, referredAccountId: Id<"accounts">, code: string | undefined) {
  if (!code) return;
  const referrer = await ctx.db.query("accounts").withIndex("by_referral_code", (q) => q.eq("referralCode", code.trim().toLowerCase())).first();
  if (!referrer || referrer._id === referredAccountId) return;
  if (await ctx.db.query("referrals").withIndex("by_referred", (q) => q.eq("referredAccountId", referredAccountId)).first()) return;
  await ctx.db.insert("referrals", { referrerAccountId: referrer._id, referredAccountId, status: "signed_up", createdAt: Date.now() });
}

/** On the referred account's first package: credits for both sides (once). */
export async function rewardReferral(ctx: MutationCtx, referredAccountId: Id<"accounts">) {
  const r = await ctx.db.query("referrals").withIndex("by_referred", (q) => q.eq("referredAccountId", referredAccountId)).first();
  if (!r || r.status !== "signed_up") return;
  const credits = (await getLiveConfig(ctx)).referralCredits;
  const now = Date.now();
  for (const accountId of [r.referrerAccountId, r.referredAccountId]) {
    const first = (await accountWorkspaces(ctx, accountId))[0];
    if (!first) continue;
    const micros = creditsToMicros(credits);
    await ctx.db.insert("creditPurchases", { orgId: first._id, accountId, polarOrderId: `referral:${r._id}:${accountId}`, topupKey: "referral", deliveryCostMicros: micros, creditsMicros: micros, remainingMicros: micros, expiresAt: now + TOPUP_VALID_DAYS * 86_400_000, status: "active", createdAt: now });
    await audit(ctx, { orgId: first._id, actorType: "system", action: "referral.rewarded", summary: `${credits} referral credits added (valid 12 months).` });
  }
  await ctx.db.patch(r._id, { status: "rewarded", credits, rewardedAt: now });
}
