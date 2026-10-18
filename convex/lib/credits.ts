import { creditsToMicros, decideReservation, microsToCredits, microsToCreditsFloor, reconcileReservation, type LedgerState, type PartialMeters } from "../../shared/economics";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ledgerOf, ledgerPatch, type BillingScope } from "./periods";
import { appError } from "./tenancy";

type Ctx = QueryCtx | MutationCtx;

/**
 * Credits ledger on top of the account's monthly usage periods. Package and
 * free credits live in the period wallet; top-up credits live in their own
 * purchases with a 12-month expiry, so they carry across months. Jobs use the
 * month's credits first, then top-ups (oldest expiry first). A workspace may
 * have a monthly cap on what it draws from the shared balance.
 */

export async function topupPool(ctx: Ctx, scope: BillingScope, now = Date.now()) {
  const accountId = scope.accountId;
  if (!accountId) return { lots: [] as Doc<"creditPurchases">[], remaining: 0, reserved: 0, available: 0, nextExpiry: null as number | null };
  const rows = await ctx.db
    .query("creditPurchases")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .take(200);
  const lots = rows
    .filter((l) => l.status === "active" && (l.remainingMicros ?? 0) > 0 && (l.expiresAt ?? 0) > now)
    .sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));
  const account = await ctx.db
    .query("creditAccounts")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .unique();
  const remaining = lots.reduce((s, l) => s + (l.remainingMicros ?? 0), 0);
  const reserved = Math.min(account?.topupReservedMicros ?? 0, remaining);
  return { lots, remaining, reserved, available: Math.max(0, remaining - reserved), nextExpiry: lots[0]?.expiresAt ?? null };
}

/** The period's ledger with the account's top-up credits as the second wallet. */
export async function creditLedger(ctx: Ctx, period: Doc<"usagePeriods">): Promise<LedgerState> {
  const pool = await topupPool(ctx, { _id: period.orgId, accountId: period.accountId });
  return { ...ledgerOf(period), topupCapMicros: pool.remaining, topupReservedMicros: pool.reserved, topupSpentMicros: 0 };
}

async function setTopupReserved(ctx: MutationCtx, accountId: Id<"accounts">, micros: number) {
  const account = await ctx.db
    .query("creditAccounts")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .unique();
  if (account) await ctx.db.patch(account._id, { topupReservedMicros: Math.max(0, micros), updatedAt: Date.now() });
  else await ctx.db.insert("creditAccounts", { accountId, topupReservedMicros: Math.max(0, micros), updatedAt: Date.now() });
}

/** Spend top-up credits, oldest expiry first. Any overage beyond what's left is absorbed. */
async function spendTopups(ctx: MutationCtx, scope: BillingScope, micros: number) {
  if (micros <= 0) return;
  const { lots } = await topupPool(ctx, scope);
  let left = micros;
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(left, lot.remainingMicros ?? 0);
    await ctx.db.patch(lot._id, { remainingMicros: (lot.remainingMicros ?? 0) - take });
    left -= take;
  }
}

/** Save a ledger decided with creditLedger: wallet and meters on the period, top-ups on the account. */
async function saveCreditLedger(ctx: MutationCtx, period: Doc<"usagePeriods">, prev: LedgerState, next: LedgerState) {
  await ctx.db.patch(period._id, {
    ...ledgerPatch(next),
    // Top-ups are tracked on their purchases, not the period.
    topupCapMicros: period.topupCapMicros,
    topupReservedMicros: period.topupReservedMicros,
    topupSpentMicros: period.topupSpentMicros,
  });
  if (period.accountId && next.topupReservedMicros !== prev.topupReservedMicros) await setTopupReserved(ctx, period.accountId, next.topupReservedMicros);
  await spendTopups(ctx, { _id: period.orgId, accountId: period.accountId }, next.topupSpentMicros - prev.topupSpentMicros);
}

async function workspaceUsage(ctx: Ctx, orgId: Id<"organizations">, periodId: Id<"usagePeriods">) {
  return ctx.db
    .query("workspaceUsage")
    .withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("periodId", periodId))
    .unique();
}

async function bumpWorkspaceUsage(ctx: MutationCtx, orgId: Id<"organizations">, periodId: Id<"usagePeriods">, delta: { reserved?: number; spent?: number }) {
  const row = await workspaceUsage(ctx, orgId, periodId);
  const now = Date.now();
  if (row) {
    await ctx.db.patch(row._id, { reservedMicros: Math.max(0, row.reservedMicros + (delta.reserved ?? 0)), spentMicros: row.spentMicros + (delta.spent ?? 0), updatedAt: now });
  } else {
    await ctx.db.insert("workspaceUsage", { orgId, periodId, reservedMicros: Math.max(0, delta.reserved ?? 0), spentMicros: delta.spent ?? 0, updatedAt: now });
  }
}

/** Plain message when a job doesn't fit: how much it needs and what's left. */
export function notEnoughCreditsMessage(needMicros: number, ledger: LedgerState): string {
  const left =
    Math.max(0, ledger.walletCapMicros - ledger.walletReservedMicros - ledger.walletSpentMicros) +
    Math.max(0, ledger.topupCapMicros - ledger.topupReservedMicros - ledger.topupSpentMicros);
  return `This needs up to ${microsToCredits(needMicros).toLocaleString("en-US")} credits and you have ${microsToCreditsFloor(left).toLocaleString("en-US")}. Add credits to continue.`;
}

/**
 * Reserve a job's worst case from the month's credits (or top-ups), within the
 * workspace's cap. Throws LIMIT_REACHED with a plain message when it doesn't fit.
 */
export async function reserveCredits(
  ctx: MutationCtx,
  params: { org: Doc<"organizations">; period: Doc<"usagePeriods">; costMicros: number; meters: PartialMeters },
): Promise<{ walletMicros: number; topupMicros: number }> {
  const { org, period, costMicros } = params;
  if (org.monthlyCreditCap !== undefined && costMicros > 0) {
    const used = await workspaceUsage(ctx, org._id, period._id);
    const capMicros = creditsToMicros(org.monthlyCreditCap);
    const spent = (used?.reservedMicros ?? 0) + (used?.spentMicros ?? 0);
    if (spent + costMicros > capMicros) {
      throw appError("LIMIT_REACHED", `This workspace's monthly cap is ${org.monthlyCreditCap.toLocaleString("en-US")} credits and ${microsToCreditsFloor(Math.max(0, capMicros - spent)).toLocaleString("en-US")} are left. The account owner can raise it.`, { reason: "workspace_cap", meter: "" });
    }
  }
  const prev = await creditLedger(ctx, period);
  // Credits are cost: a top-up pays the same credits as the month's balance.
  const decision = decideReservation(prev, { costMicros, topupCostMicros: costMicros, meters: params.meters });
  if (!decision.ok) {
    throw appError("LIMIT_REACHED", decision.reason === "wallet_limit" ? notEnoughCreditsMessage(costMicros, prev) : decision.message, { reason: decision.reason, meter: decision.meter ?? "" });
  }
  await saveCreditLedger(ctx, period, prev, decision.next);
  if (costMicros > 0) await bumpWorkspaceUsage(ctx, org._id, period._id, { reserved: decision.walletMicros + decision.topupMicros });
  return { walletMicros: decision.walletMicros, topupMicros: decision.topupMicros };
}

/** Like reserveCredits, but returns { ok: false } instead of throwing (mid-job extra rounds). */
export async function tryReserveCredits(ctx: MutationCtx, params: Parameters<typeof reserveCredits>[1]) {
  try {
    return { ok: true as const, ...(await reserveCredits(ctx, params)) };
  } catch (e) {
    return { ok: false as const, message: ((e as { data?: { message?: string } }).data?.message ?? (e as Error).message) };
  }
}

/** Charge what a job actually used and release the rest of its reservation. */
export async function settleCredits(
  ctx: MutationCtx,
  params: { orgId: Id<"organizations">; period: Doc<"usagePeriods">; reservation: { walletMicros: number; topupMicros: number; meters: PartialMeters }; actualMicros: number; meters: PartialMeters },
): Promise<{ overageMicros: number }> {
  const { period, reservation } = params;
  const prev = await creditLedger(ctx, period);
  const { next, overageMicros } = reconcileReservation(prev, reservation, { costMicros: params.actualMicros, topupCostMicros: params.actualMicros, meters: params.meters });
  await saveCreditLedger(ctx, period, prev, next);
  await bumpWorkspaceUsage(ctx, params.orgId, period._id, { reserved: -(reservation.walletMicros + reservation.topupMicros), spent: params.actualMicros });
  return { overageMicros };
}

/** Owner-facing balance in credits (never dollars). */
export async function creditBalance(ctx: Ctx, org: Doc<"organizations">, period: Doc<"usagePeriods"> | null) {
  const pool = await topupPool(ctx, org);
  const monthlyCap = period?.walletCapMicros ?? 0;
  const monthlyUsed = (period?.walletSpentMicros ?? 0) + (period?.walletReservedMicros ?? 0);
  const ws = period ? await workspaceUsage(ctx, org._id, period._id) : null;
  return {
    monthly: { total: microsToCreditsFloor(monthlyCap), used: microsToCredits(monthlyUsed), left: microsToCreditsFloor(Math.max(0, monthlyCap - monthlyUsed)) },
    topup: { left: microsToCreditsFloor(pool.available), nextExpiry: pool.nextExpiry },
    available: microsToCreditsFloor(Math.max(0, monthlyCap - monthlyUsed) + pool.available),
    workspace: { used: microsToCredits((ws?.spentMicros ?? 0) + (ws?.reservedMicros ?? 0)), cap: org.monthlyCreditCap ?? null },
    resetsAt: period?.source === "subscription" ? period.endsAt : null,
    source: period?.source ?? null,
  };
}
