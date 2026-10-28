/**
 * Follower counts for connected social accounts: Instagram professional accounts
 * (followers_count) and Facebook Pages (followers_count, falling back to fan_count).
 * Read-only; uses the scopes the connections already hold.
 */

import { asNumber, isRecord } from "./http";
import { graphGet, metaReadFailure, type GraphCall } from "./metaGraph";
import { GRAPH_BASE, INSTAGRAM_GRAPH_BASE } from "./registry";
import type { ReadResult } from "./types";

export type FollowerProvider = "instagram" | "facebook_pages";

export async function getFollowerCount(call: GraphCall & { provider: FollowerProvider; accountId: string }): Promise<ReadResult<{ count: number }>> {
  if (!/^\d+$/.test(call.accountId)) return { ok: false, providerMessage: "Invalid account id", retryable: false };
  const base = call.provider === "instagram" ? INSTAGRAM_GRAPH_BASE : GRAPH_BASE;
  const url = new URL(`${base}/${call.accountId}`);
  url.searchParams.set("fields", call.provider === "instagram" ? "followers_count" : "followers_count,fan_count");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  const d = isRecord(out.data) ? out.data : {};
  const raw = d.followers_count ?? d.fan_count;
  if (raw === undefined || raw === null || raw === "") return { ok: false, providerMessage: "No follower count returned", retryable: false };
  const count = asNumber(raw);
  if (count < 0) return { ok: false, providerMessage: "No follower count returned", retryable: false };
  return { ok: true, data: { count } };
}

export interface FollowerPoint {
  day: string;
  count: number;
}

/** Latest count, change over the last 7 days (null when there's no point that old), and one point per week for a small chart. */
export function followerSummary(points: FollowerPoint[], today: string): { latest: number | null; weekChange: number | null; weekly: number[] } {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const latest = sorted.at(-1)?.count ?? null;
  const weekAgo = shiftDay(today, -7);
  const base = [...sorted].reverse().find((p) => p.day <= weekAgo);
  const weekly: number[] = [];
  for (let w = 7; w >= 0; w--) {
    const cutoff = shiftDay(today, -7 * w);
    const point = [...sorted].reverse().find((p) => p.day <= cutoff);
    if (point) weekly.push(point.count);
  }
  return { latest, weekChange: latest !== null && base ? latest - base.count : null, weekly };
}

export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
