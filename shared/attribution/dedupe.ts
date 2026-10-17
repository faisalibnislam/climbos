import type { ConversionEvent, RevenueEvent } from "./types";

export interface DedupeResult<T> {
  events: T[];
  /** Number of input events dropped as duplicates. */
  duplicates: number;
  /** Keys that appeared more than once. */
  duplicateKeys: string[];
}

/** Dedupe key for revenue events: (source, sourceEventId). */
export function revenueEventKey(e: Pick<RevenueEvent, "source" | "sourceEventId">): string {
  return `${e.source}\u0000${e.sourceEventId}`;
}

/**
 * Drops repeated revenue events with the same (source, sourceEventId), e.g.
 * webhook retries or overlapping backfills. Keeps the FIRST occurrence in
 * input order; later copies are assumed to be redeliveries, not updates
 * (apply updates upstream before calling this).
 */
export function dedupeRevenueEvents(events: readonly RevenueEvent[]): DedupeResult<RevenueEvent> {
  const seen = new Set<string>();
  const dupKeys = new Set<string>();
  const out: RevenueEvent[] = [];
  for (const e of events) {
    const k = revenueEventKey(e);
    if (seen.has(k)) {
      dupKeys.add(k);
      continue;
    }
    seen.add(k);
    out.push(e);
  }
  return {
    events: out,
    duplicates: events.length - out.length,
    duplicateKeys: [...dupKeys].map((k) => k.replace("\u0000", ":")),
  };
}

/**
 * Dedupes browser/server conversion events that share an eventId (the same
 * conversion reported by a pixel and a server API). Prefers the server-side
 * copy when both exist (less exposed to ad blockers and client tampering);
 * otherwise keeps the first seen. Output preserves first-seen order of ids.
 */
export function dedupeConversionEvents(events: readonly ConversionEvent[]): DedupeResult<ConversionEvent> {
  const byId = new Map<string, ConversionEvent>();
  const dupKeys = new Set<string>();
  for (const e of events) {
    const existing = byId.get(e.eventId);
    if (!existing) {
      byId.set(e.eventId, e);
      continue;
    }
    dupKeys.add(e.eventId);
    if (existing.origin === "browser" && e.origin === "server") byId.set(e.eventId, e);
  }
  const out = [...byId.values()];
  return { events: out, duplicates: events.length - out.length, duplicateKeys: [...dupKeys] };
}
