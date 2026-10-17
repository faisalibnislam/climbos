/**
 * Pure billing policy: subscription access, webhook ordering, grant rules and
 * Standard Webhooks signature verification (used by Polar and Resend/Svix).
 */

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "revoked";

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  endedAt?: number;
  sourceModifiedAt: number;
}

export type AccessLevel =
  /** New chargeable work allowed. */
  | "full"
  /** Payment unresolved: read and export only; no new chargeable work. */
  | "grace_read_only"
  /** Subscription over: read and export only. */
  | "ended"
  /** Waiting for the subscription to activate. */
  | "pending";

/**
 * Conservative grace policy:
 * - active/trialing → full.
 * - canceled at period end → full until the recorded period end, then ended.
 * - past_due/unpaid → read/export only until payment recovers.
 * - revoked, or canceled with an end in the past → ended (stops new paid work immediately).
 */
export function subscriptionAccess(sub: SubscriptionSnapshot, now: number): AccessLevel {
  switch (sub.status) {
    case "active":
    case "trialing":
      if (sub.cancelAtPeriodEnd && now >= sub.currentPeriodEnd) return "ended";
      return "full";
    case "canceled":
      if (sub.cancelAtPeriodEnd && now < sub.currentPeriodEnd && !sub.endedAt) return "full";
      return "ended";
    case "past_due":
    case "unpaid":
      return "grace_read_only";
    case "revoked":
      return "ended";
    case "incomplete":
      return "pending";
  }
}

/** Out-of-order guard: only apply an event snapshot that is at least as new as what we hold. */
export function shouldApplySnapshot(currentModifiedAt: number | undefined, incomingModifiedAt: number): boolean {
  return currentModifiedAt === undefined || incomingModifiedAt >= currentModifiedAt;
}

/** Map Polar subscription payloads to our status (revocation is authoritative and terminal). */
export function mapPolarSubscriptionStatus(eventType: string, status: string): SubscriptionStatus {
  if (eventType === "subscription.revoked") return "revoked";
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      return status;
    case "incomplete_expired":
      return "revoked";
    default:
      return "incomplete";
  }
}

export type GrantKind = "subscription_period" | "topup" | "none";

/**
 * Only a PAID order grants anything. `subscription.cycled` alone never grants:
 * the renewal allowance is granted on the paid order for that cycle.
 */
export function grantForOrder(params: {
  eventType: string;
  orderStatus: string;
  paid: boolean;
  billingReason: string;
  productKind: "plan" | "topup" | "unknown";
}): GrantKind {
  if (params.eventType !== "order.paid" && params.eventType !== "order.updated") return "none";
  if (!params.paid || params.orderStatus !== "paid") return "none";
  if (params.productKind === "topup" && params.billingReason === "purchase") return "topup";
  if (
    params.productKind === "plan" &&
    ["subscription_create", "subscription_cycle", "subscription_update"].includes(params.billingReason)
  ) {
    return "subscription_period";
  }
  return "none";
}

/* ------------------------------------------------------------------ */
/* Standard Webhooks (https://www.standardwebhooks.com)                 */
/* ------------------------------------------------------------------ */

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function tryDecodeBase64(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.length % 4 !== 0) return null;
  try {
    return base64ToBytes(s);
  } catch {
    return null;
  }
}

/**
 * Candidate HMAC keys for a webhook secret, mirroring the Polar SDK (1.0.x):
 * the secret's UTF-8 bytes, plus the base64-decoded secret (after an optional
 * "whsec_" prefix) when it decodes to different bytes. Svix/Resend secrets are
 * "whsec_<base64>" and match the decoded key.
 */
export function webhookKeyCandidates(secret: string): Uint8Array[] {
  if (!secret) throw new WebhookVerificationError("Webhook secret is not configured");
  const utf8 = new TextEncoder().encode(secret);
  const keys: Uint8Array[] = [utf8];
  const decoded = tryDecodeBase64(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  if (decoded && decoded.byteLength > 0 && !(decoded.length === utf8.length && decoded.every((b, i) => b === utf8[i]))) {
    keys.push(decoded);
  }
  return keys;
}

export async function signStandardWebhook(
  key: Uint8Array,
  id: string,
  timestampSeconds: number,
  body: string,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${id}.${timestampSeconds}.${body}`));
  return `v1,${bytesToBase64(new Uint8Array(sig))}`;
}

/** Verify id/timestamp/signature headers against the raw body. Throws on failure. */
export async function verifyStandardWebhook(params: {
  keys: Uint8Array[];
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): Promise<void> {
  const { keys, id, timestamp, signatureHeader, body } = params;
  if (!id || !timestamp || !signatureHeader) throw new WebhookVerificationError("Missing webhook headers");
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new WebhookVerificationError("Invalid timestamp");
  const now = params.nowSeconds ?? Date.now() / 1000;
  const tolerance = params.toleranceSeconds ?? 300;
  if (Math.abs(now - ts) > tolerance) throw new WebhookVerificationError("Timestamp outside tolerance (possible replay)");
  const signed = new TextEncoder().encode(`${id}.${Math.floor(ts)}.${body}`);
  const cryptoKeys = await Promise.all(
    keys.map((k) => crypto.subtle.importKey("raw", k as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["verify"])),
  );
  for (const part of signatureHeader.split(" ")) {
    const [version, signature] = part.split(",", 2);
    if (version !== "v1" || !signature) continue;
    const decoded = tryDecodeBase64(signature);
    if (!decoded) continue;
    for (const key of cryptoKeys) {
      if (await crypto.subtle.verify("HMAC", key, decoded as BufferSource, signed)) return;
    }
  }
  throw new WebhookVerificationError("Signature mismatch");
}
