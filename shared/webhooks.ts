/** Outgoing webhook events ClimbOS sends (stable names; payloads are JSON). */
export const WEBHOOK_EVENTS = {
  "lead.created": "A new lead: chat email, landing page or link-in-bio sign-up, or added by hand",
  "deal.won": "A deal moved to won",
  "booking.created": "Someone booked a call",
  "chat.started": "A new website chat",
  "reply.received": "Someone replied to your outreach",
  "post.published": "A post went live",
} as const;
export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;
export const isWebhookEvent = (s: string): s is WebhookEvent => s in WEBHOOK_EVENTS;

/** Retry schedule after a failed delivery: 1m, 5m, 30m, 2h, 12h, then give up. */
export const RETRY_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];

export async function signWebhook(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}
