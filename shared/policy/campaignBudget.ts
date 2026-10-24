/** Cross-platform reservation for scheduled Google and Meta ad spend. */

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 31;
const RESERVED_STATUSES = new Set(["needs_approval", "created_paused", "active", "paused", "uncertain"]);

export interface CampaignBudgetReservation {
  status: string;
  currency: string;
  dailyBudgetMinor?: number;
  startDate?: string;
  endDate?: string;
}

export type RollingBudgetResult =
  | { ok: true; maxSpendMinor: number; windowStart: string }
  | { ok: false; reason: "invalid_date" | "unknown_reservation" | "currency_mismatch" };

function dayMs(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

/**
 * Return the highest authorized spend in any future 31-day UTC window.
 * Reservations are planned daily caps, not actual platform spend or causal ROI.
 */
export function maxRolling31DaySpend(
  reservations: readonly CampaignBudgetReservation[],
  policyCurrency: string,
  today: string,
): RollingBudgetResult {
  const todayMs = dayMs(today);
  if (todayMs === null) return { ok: false, reason: "invalid_date" };
  const currency = policyCurrency.trim().toUpperCase();
  if (!currency) return { ok: false, reason: "currency_mismatch" };

  const active: { start: number; end: number; daily: number }[] = [];
  for (const item of reservations) {
    if (!RESERVED_STATUSES.has(item.status)) continue;
    const end = item.endDate ? dayMs(item.endDate) : null;
    if (end !== null && end < todayMs) continue;
    const start = item.startDate ? dayMs(item.startDate) : null;
    const daily = item.dailyBudgetMinor;
    if (item.currency.trim().toUpperCase() !== currency) return { ok: false, reason: "currency_mismatch" };
    if (start === null || end === null || end < start || typeof daily !== "number" || !Number.isSafeInteger(daily) || daily <= 0) {
      return { ok: false, reason: "unknown_reservation" };
    }
    active.push({ start: Math.max(start, todayMs), end, daily });
  }

  if (!active.length) return { ok: true, maxSpendMinor: 0, windowStart: today };

  // A rolling-window sum is piecewise linear in its start date. Its extrema
  // occur at these schedule boundaries, so there is no need to scan every day.
  const candidates = new Set<number>([todayMs]);
  const lastEnd = Math.max(...active.map((item) => item.end));
  for (const item of active) {
    for (const boundary of [item.start - (WINDOW_DAYS - 1) * DAY_MS, item.start, item.end - (WINDOW_DAYS - 1) * DAY_MS, item.end]) {
      const candidate = Math.max(todayMs, boundary);
      if (candidate <= lastEnd) candidates.add(candidate);
    }
  }

  let maxSpendMinor = 0;
  let maxStart = todayMs;
  for (const start of candidates) {
    const end = start + (WINDOW_DAYS - 1) * DAY_MS;
    let spend = 0;
    for (const item of active) {
      const overlapStart = Math.max(start, item.start);
      const overlapEnd = Math.min(end, item.end);
      if (overlapEnd >= overlapStart) spend += (overlapEnd - overlapStart) / DAY_MS * item.daily + item.daily;
      if (!Number.isSafeInteger(spend)) return { ok: false, reason: "unknown_reservation" };
    }
    if (spend > maxSpendMinor) {
      maxSpendMinor = spend;
      maxStart = start;
    }
  }

  return { ok: true, maxSpendMinor, windowStart: new Date(maxStart).toISOString().slice(0, 10) };
}

export function validCampaignDateRange(startDate: string, endDate: string): boolean {
  const start = dayMs(startDate);
  const end = dayMs(endDate);
  return start !== null && end !== null && end >= start;
}
