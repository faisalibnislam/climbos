/**
 * Pure usage-ledger arithmetic. Convex mutations call these inside a single
 * transaction (serializable), so the check-and-reserve is atomic: two
 * concurrent jobs can never both pass a check that only one fits.
 *
 * Invariants (tested):
 *   walletReserved + walletSpent ≤ walletCap          (plan wallet)
 *   topupReserved + topupSpent ≤ topupCap             (top-up wallet)
 *   meterReserved[m] + meterUsed[m] ≤ meterCap[m]     (task-count quotas)
 * Both the task-count quota AND the dollar wallet must pass.
 */

import type { MeterKey } from "./entitlements";

export type Meters = Record<MeterKey, number>;
export type PartialMeters = Partial<Record<MeterKey, number>>;

export const METER_KEYS: readonly MeterKey[] = [
  "socialPosts",
  "imageAttempts",
  "deliveredImages",
  "searchCalls",
  "scrapeCredits",
  "transactionalEmails",
  "byoMarketingSends",
  "analyticsEvents",
  "supportMinutes",
];

export function zeroMeters(): Meters {
  return {
    socialPosts: 0,
    imageAttempts: 0,
    deliveredImages: 0,
    searchCalls: 0,
    scrapeCredits: 0,
    transactionalEmails: 0,
    byoMarketingSends: 0,
    analyticsEvents: 0,
    supportMinutes: 0,
  };
}

export interface LedgerState {
  walletCapMicros: number;
  walletReservedMicros: number;
  walletSpentMicros: number;
  topupCapMicros: number;
  topupReservedMicros: number;
  topupSpentMicros: number;
  meterCaps: Meters;
  meterUsed: Meters;
  meterReserved: Meters;
}

export interface ReservationRequest {
  /** Worst-case provider cost (µUSD) for AI/image/research in this job. */
  costMicros: number;
  /** Stressed delivery cost used if the plan wallet is exhausted and a top-up pays. */
  topupCostMicros: number;
  meters: PartialMeters;
}

export type ReservationDecision =
  | { ok: true; walletMicros: number; topupMicros: number; next: LedgerState }
  | {
      ok: false;
      reason: "meter_limit" | "wallet_limit" | "invalid";
      meter?: MeterKey;
      message: string;
    };

function assertNonNegInt(n: number, label: string) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`${label} must be a non-negative integer, received ${n}`);
}

/** Decide (without side effects) whether a reservation fits; return the next state if so. */
export function decideReservation(state: LedgerState, req: ReservationRequest): ReservationDecision {
  try {
    assertNonNegInt(req.costMicros, "costMicros");
    assertNonNegInt(req.topupCostMicros, "topupCostMicros");
    for (const [k, v] of Object.entries(req.meters)) assertNonNegInt(v ?? 0, `meter ${k}`);
  } catch (e) {
    return { ok: false, reason: "invalid", message: (e as Error).message };
  }

  for (const key of METER_KEYS) {
    const want = req.meters[key] ?? 0;
    if (want === 0) continue;
    const available = state.meterCaps[key] - state.meterUsed[key] - state.meterReserved[key];
    if (want > available) {
      return {
        ok: false,
        reason: "meter_limit",
        meter: key,
        message: `This would go over this month's limit (${Math.max(available, 0)} left).`,
      };
    }
  }

  const walletAvailable = state.walletCapMicros - state.walletReservedMicros - state.walletSpentMicros;
  let walletMicros = 0;
  let topupMicros = 0;
  if (req.costMicros <= walletAvailable) {
    walletMicros = req.costMicros;
  } else {
    // The plan wallet can't cover the whole job: a top-up must cover the job's
    // full stressed delivery cost (no splitting a job across both wallets).
    const topupAvailable = state.topupCapMicros - state.topupReservedMicros - state.topupSpentMicros;
    if (req.topupCostMicros > topupAvailable || (req.topupCostMicros === 0 && req.costMicros > 0)) {
      return {
        ok: false,
        reason: "wallet_limit",
        message: "You've reached this month's AI capacity. Add an extra capacity pack or wait for next month.",
      };
    }
    topupMicros = req.topupCostMicros;
  }

  const meterReserved = { ...state.meterReserved };
  for (const key of METER_KEYS) meterReserved[key] += req.meters[key] ?? 0;

  return {
    ok: true,
    walletMicros,
    topupMicros,
    next: {
      ...state,
      walletReservedMicros: state.walletReservedMicros + walletMicros,
      topupReservedMicros: state.topupReservedMicros + topupMicros,
      meterReserved,
    },
  };
}

/**
 * Reconcile a reservation exactly once with actual usage. Actual cost may
 * exceed the reservation only if the provider reported more than the worst
 * case; that overage is still recorded as spent (never hidden), and the
 * caller must flag it for review. Unused meters are released.
 */
export function reconcileReservation(
  state: LedgerState,
  reservation: { walletMicros: number; topupMicros: number; meters: PartialMeters },
  actual: { costMicros: number; topupCostMicros: number; meters: PartialMeters },
): { next: LedgerState; overageMicros: number } {
  const meterReserved = { ...state.meterReserved };
  const meterUsed = { ...state.meterUsed };
  for (const key of METER_KEYS) {
    meterReserved[key] = Math.max(0, meterReserved[key] - (reservation.meters[key] ?? 0));
    meterUsed[key] += actual.meters[key] ?? 0;
  }
  const usedTopup = reservation.topupMicros > 0;
  // A reservation split across both wallets (extra rounds reserved later) charges the plan wallet up to its
  // share, then the top-up; one held only in the top-up charges the top-up its own (stressed) cost.
  const walletCharge = !usedTopup ? actual.costMicros : Math.min(actual.costMicros, reservation.walletMicros);
  const topupCharge = !usedTopup ? 0 : reservation.walletMicros > 0 ? actual.costMicros - walletCharge : actual.topupCostMicros;
  const next: LedgerState = {
    ...state,
    meterReserved,
    meterUsed,
    walletReservedMicros: Math.max(0, state.walletReservedMicros - reservation.walletMicros),
    topupReservedMicros: Math.max(0, state.topupReservedMicros - reservation.topupMicros),
    walletSpentMicros: state.walletSpentMicros + walletCharge,
    topupSpentMicros: state.topupSpentMicros + topupCharge,
  };
  const overageMicros = usedTopup
    ? Math.max(0, topupCharge - reservation.topupMicros)
    : Math.max(0, actual.costMicros - reservation.walletMicros);
  return { next, overageMicros };
}

/** Release a reservation without spending (job canceled before any provider call). */
export function releaseReservation(
  state: LedgerState,
  reservation: { walletMicros: number; topupMicros: number; meters: PartialMeters },
): LedgerState {
  return reconcileReservation(state, reservation, { costMicros: 0, topupCostMicros: 0, meters: {} }).next;
}

export function checkInvariants(state: LedgerState): string[] {
  const problems: string[] = [];
  if (state.walletReservedMicros + state.walletSpentMicros > state.walletCapMicros) {
    problems.push("plan wallet over cap");
  }
  if (state.topupReservedMicros + state.topupSpentMicros > state.topupCapMicros) {
    problems.push("top-up wallet over cap");
  }
  for (const key of METER_KEYS) {
    if (state.meterReserved[key] + state.meterUsed[key] > state.meterCaps[key]) problems.push(`meter ${key} over cap`);
  }
  return problems;
}

/** Fraction used (spent + reserved) of each limit — for 70/90/100% alerts and UI meters. */
export function usageFractions(state: LedgerState): { wallet: number; meters: Record<MeterKey, number> } {
  const wallet =
    state.walletCapMicros > 0 ? (state.walletSpentMicros + state.walletReservedMicros) / state.walletCapMicros : 1;
  const meters = {} as Record<MeterKey, number>;
  for (const key of METER_KEYS) {
    const cap = state.meterCaps[key];
    meters[key] = cap > 0 ? (state.meterUsed[key] + state.meterReserved[key]) / cap : 0;
  }
  return { wallet, meters };
}
