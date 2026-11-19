import { z } from "zod";

/** First-party, server-to-server milestone reports; no browser identity inference or arbitrary properties. */
export const PRODUCT_EVENT_LIMIT = 1000;
export const PRODUCT_EVENT_RETENTION_MS = 30 * 86_400_000;
export const PRODUCT_EVENT_MAX_AGE_MS = 7 * 86_400_000;
export const PRODUCT_SOURCE_LIMIT = 20;
export const productEventName = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$/);
export const productEventInput = z.object({
  eventId: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/),
  email: z.string().trim().toLowerCase().email().max(254),
  event: productEventName,
  occurredAt: z.string().datetime({ offset: true }),
}).strict();

export const PRODUCT_EVENT_OUTCOMES = {
  applied: "Progress updated",
  older: "Older event kept as history",
  owner_override: "Owner observation kept",
  conflict: "Conflicting events; progress is unknown",
} as const;
