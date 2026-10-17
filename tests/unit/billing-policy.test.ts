import { describe, expect, it } from "vitest";
import { webhooks } from "@polar-sh/sdk/2026-10";
import {
  grantForOrder,
  mapPolarSubscriptionStatus,
  shouldApplySnapshot,
  signStandardWebhook,
  subscriptionAccess,
  verifyStandardWebhook,
  WebhookVerificationError,
  webhookKeyCandidates,
} from "../../shared/billing";
import {
  approvalHash,
  canonicalJson,
  canTransition,
  checkApprovalForExecution,
  contentHash,
  idempotencyKey,
} from "../../shared/policy";
import {
  checkInvariants,
  decideReservation,
  type LedgerState,
  reconcileReservation,
  releaseReservation,
  zeroMeters,
} from "../../shared/economics/ledger";

const DAY = 86_400_000;

describe("subscription access policy", () => {
  const base = { cancelAtPeriodEnd: false, currentPeriodStart: 0, currentPeriodEnd: 30 * DAY, sourceModifiedAt: 1 };
  it("active grants full access", () => {
    expect(subscriptionAccess({ ...base, status: "active" }, DAY)).toBe("full");
  });
  it("canceled at period end keeps access until the recorded end", () => {
    const sub = { ...base, status: "canceled" as const, cancelAtPeriodEnd: true };
    expect(subscriptionAccess(sub, 29 * DAY)).toBe("full");
    expect(subscriptionAccess(sub, 30 * DAY)).toBe("ended");
  });
  it("revocation stops new paid work immediately", () => {
    expect(subscriptionAccess({ ...base, status: "revoked" }, DAY)).toBe("ended");
    expect(mapPolarSubscriptionStatus("subscription.revoked", "active")).toBe("revoked");
  });
  it("past due is read/export only", () => {
    expect(subscriptionAccess({ ...base, status: "past_due" }, DAY)).toBe("grace_read_only");
    expect(subscriptionAccess({ ...base, status: "unpaid" }, DAY)).toBe("grace_read_only");
  });
  it("ignores stale (out-of-order) snapshots", () => {
    expect(shouldApplySnapshot(undefined, 5)).toBe(true);
    expect(shouldApplySnapshot(10, 5)).toBe(false);
    expect(shouldApplySnapshot(10, 10)).toBe(true);
  });
});

describe("grant rules", () => {
  it("only paid orders grant", () => {
    expect(
      grantForOrder({ eventType: "order.paid", orderStatus: "paid", paid: true, billingReason: "subscription_cycle", productKind: "plan" }),
    ).toBe("subscription_period");
    expect(
      grantForOrder({ eventType: "order.created", orderStatus: "pending", paid: false, billingReason: "subscription_cycle", productKind: "plan" }),
    ).toBe("none");
    expect(
      grantForOrder({ eventType: "subscription.cycled", orderStatus: "paid", paid: true, billingReason: "subscription_cycle", productKind: "plan" }),
    ).toBe("none");
    expect(
      grantForOrder({ eventType: "order.paid", orderStatus: "paid", paid: true, billingReason: "purchase", productKind: "topup" }),
    ).toBe("topup");
    expect(
      grantForOrder({ eventType: "order.paid", orderStatus: "paid", paid: true, billingReason: "purchase", productKind: "unknown" }),
    ).toBe("none");
  });
});

describe("standard webhook signatures", () => {
  const body = JSON.stringify({ type: "order.paid", timestamp: "2026-10-17T00:00:00Z", data: { id: "ord_1" } });

  it("accepts a valid Polar signature and matches the official Polar SDK", async () => {
    const secret = "polar_whs_test_secret_value";
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signStandardWebhook(webhookKeyCandidates(secret)[0], "msg_1", ts, body);
    await expect(
      verifyStandardWebhook({ keys: webhookKeyCandidates(secret), id: "msg_1", timestamp: String(ts), signatureHeader: sig, body }),
    ).resolves.toBeUndefined();
    // The official SDK must accept the same signature.
    const event = await webhooks.validateEvent(
      body,
      { "webhook-id": "msg_1", "webhook-timestamp": String(ts), "webhook-signature": sig },
      secret,
    );
    expect((event as { type: string }).type).toBe("order.paid");
  });

  it("rejects forged signatures, tampered bodies and replays", async () => {
    const secret = "polar_whs_test_secret_value";
    const keys = webhookKeyCandidates(secret);
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signStandardWebhook(keys[0], "msg_1", ts, body);
    const forged = await signStandardWebhook(new TextEncoder().encode("attacker"), "msg_1", ts, body);
    await expect(
      verifyStandardWebhook({ keys, id: "msg_1", timestamp: String(ts), signatureHeader: forged, body }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
    await expect(
      verifyStandardWebhook({ keys, id: "msg_1", timestamp: String(ts), signatureHeader: sig, body: body + " " }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
    await expect(
      verifyStandardWebhook({ keys, id: "msg_2", timestamp: String(ts), signatureHeader: sig, body }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
    const old = ts - 3600;
    const oldSig = await signStandardWebhook(keys[0], "msg_1", old, body);
    await expect(
      verifyStandardWebhook({ keys, id: "msg_1", timestamp: String(old), signatureHeader: oldSig, body }),
    ).rejects.toThrow(/tolerance/);
    await expect(
      verifyStandardWebhook({ keys, id: null, timestamp: String(ts), signatureHeader: sig, body }),
    ).rejects.toThrow(/Missing/);
  });

  it("verifies Svix/Resend-style whsec_ secrets", async () => {
    const raw = new Uint8Array(24).map((_, i) => i + 1);
    const secret = `whsec_${btoa(String.fromCharCode(...raw))}`;
    const ts = Math.floor(Date.now() / 1000);
    const sig = await signStandardWebhook(raw, "msg_x", ts, body);
    await expect(
      verifyStandardWebhook({ keys: webhookKeyCandidates(secret), id: "msg_x", timestamp: String(ts), signatureHeader: `v1,bogus ${sig}`, body }),
    ).resolves.toBeUndefined();
  });
});

describe("job state machine", () => {
  it("follows proposed → … → verified and blocks illegal jumps", () => {
    const path = ["proposed", "cost_reserved", "preparing", "needs_approval", "approved", "scheduled", "executing", "verified"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
    expect(canTransition("proposed", "executing")).toBe(false);
    expect(canTransition("needs_approval", "executing")).toBe(false);
    expect(canTransition("verified", "executing")).toBe(false);
    expect(canTransition("uncertain", "executing")).toBe(false);
  });
});

describe("approvals", () => {
  const content = { body: "Build a form in 30 seconds", hashtags: ["#forms"], channel: "instagram", altText: "A form builder" };
  async function setup() {
    const ch = await contentHash(content);
    const binding = {
      orgId: "org1",
      subjectType: "artifact",
      subjectId: "a1",
      actionKind: "publish",
      contentHash: ch,
      scope: { connectionId: "c1", destination: "instagram" },
      policyVersion: 3,
      expiresAt: 10_000,
    };
    const approval = { status: "approved", approvalHash: await approvalHash(binding), expiresAt: 10_000, scope: binding.scope, contentHash: ch, policyVersion: 3 };
    return { binding, approval };
  }

  it("canonical JSON is key-order independent", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });

  it("passes when nothing changed", async () => {
    const { binding, approval } = await setup();
    expect(await checkApprovalForExecution({ approval, current: binding, now: 5_000, emergencyStop: false, capabilityReady: true })).toEqual({ ok: true });
  });

  it("an edited artifact invalidates the approval", async () => {
    const { binding, approval } = await setup();
    const edited = await contentHash({ ...content, body: "Build a form in 10 seconds" });
    const res = await checkApprovalForExecution({ approval, current: { ...binding, contentHash: edited }, now: 5_000, emergencyStop: false, capabilityReady: true });
    expect(res).toMatchObject({ ok: false, reason: "content_changed" });
  });

  it("expiry, wrong account, policy change, emergency stop and revoked capability block execution", async () => {
    const { binding, approval } = await setup();
    const base = { approval, current: binding, emergencyStop: false, capabilityReady: true };
    expect(await checkApprovalForExecution({ ...base, now: 20_000 })).toMatchObject({ reason: "expired" });
    expect(
      await checkApprovalForExecution({ ...base, now: 1, current: { ...binding, scope: { ...binding.scope, connectionId: "c2" } } }),
    ).toMatchObject({ reason: "wrong_account" });
    expect(await checkApprovalForExecution({ ...base, now: 1, current: { ...binding, policyVersion: 4 } })).toMatchObject({ reason: "policy_changed" });
    expect(await checkApprovalForExecution({ ...base, now: 1, emergencyStop: true })).toMatchObject({ reason: "emergency_stop" });
    expect(await checkApprovalForExecution({ ...base, now: 1, capabilityReady: false })).toMatchObject({ reason: "capability_unavailable" });
    expect(
      await checkApprovalForExecution({ ...base, now: 1, current: { ...binding, scope: { ...binding.scope, audience: "everyone" } } }),
    ).toMatchObject({ reason: "scope_changed" });
  });

  it("idempotency keys are scoped to tenant, step and version", () => {
    expect(idempotencyKey({ orgId: "o", runId: "r", stepIndex: 2, subject: "a1", version: 3 })).toBe("o:r:s2:a1:v3");
    expect(idempotencyKey({ orgId: "o", runId: "r", stepIndex: 2, subject: "a1", version: 4 })).not.toBe(
      idempotencyKey({ orgId: "o", runId: "r", stepIndex: 2, subject: "a1", version: 3 }),
    );
  });
});

describe("cost ledger", () => {
  function ledger(walletCap = 1_000_000, topupCap = 0): LedgerState {
    return {
      walletCapMicros: walletCap,
      walletReservedMicros: 0,
      walletSpentMicros: 0,
      topupCapMicros: topupCap,
      topupReservedMicros: 0,
      topupSpentMicros: 0,
      meterCaps: { ...zeroMeters(), socialPosts: 10, imageAttempts: 4 },
      meterUsed: zeroMeters(),
      meterReserved: zeroMeters(),
    };
  }

  it("serialized concurrent reservations can never overspend", () => {
    // Simulate 50 jobs racing for the same wallet: each decision sees the state
    // committed by the previous one, exactly as Convex's serializable mutations do.
    let state = ledger(1_000_000);
    let accepted = 0;
    for (let i = 0; i < 50; i++) {
      const d = decideReservation(state, { costMicros: 70_000, topupCostMicros: 0, meters: { socialPosts: 1 } });
      if (d.ok) {
        state = d.next;
        accepted++;
      }
      expect(checkInvariants(state)).toEqual([]);
    }
    expect(accepted).toBe(10); // meter cap (10 posts) binds before the wallet (14 × $0.07)
    expect(state.walletReservedMicros).toBe(700_000);
  });

  it("both task-count quota and dollar wallet must pass", () => {
    const s = ledger(100_000);
    expect(decideReservation(s, { costMicros: 200_000, topupCostMicros: 0, meters: { socialPosts: 1 } })).toMatchObject({
      ok: false,
      reason: "wallet_limit",
    });
    expect(decideReservation(s, { costMicros: 1, topupCostMicros: 0, meters: { imageAttempts: 5 } })).toMatchObject({
      ok: false,
      reason: "meter_limit",
      meter: "imageAttempts",
    });
  });

  it("reconciles once; failed jobs release meters but still pay for provider calls made", () => {
    let s = ledger();
    const d = decideReservation(s, { costMicros: 100_000, topupCostMicros: 0, meters: { socialPosts: 3 } });
    if (!d.ok) throw new Error("expected ok");
    s = d.next;
    const r = reconcileReservation(s, { walletMicros: d.walletMicros, topupMicros: 0, meters: { socialPosts: 3 } }, { costMicros: 40_000, topupCostMicros: 0, meters: {} });
    expect(r.next.walletReservedMicros).toBe(0);
    expect(r.next.walletSpentMicros).toBe(40_000);
    expect(r.next.meterReserved.socialPosts).toBe(0);
    expect(r.next.meterUsed.socialPosts).toBe(0);
    expect(r.overageMicros).toBe(0);
  });

  it("retries consume budget: a failing job cannot retry for free forever", () => {
    let s = ledger(300_000);
    let attempts = 0;
    while (true) {
      const d = decideReservation(s, { costMicros: 100_000, topupCostMicros: 0, meters: {} });
      if (!d.ok) break;
      attempts++;
      // Each failed attempt still spent its provider cost.
      s = reconcileReservation(d.next, { walletMicros: d.walletMicros, topupMicros: 0, meters: {} }, { costMicros: 100_000, topupCostMicros: 0, meters: {} }).next;
    }
    expect(attempts).toBe(3);
    expect(checkInvariants(s)).toEqual([]);
  });

  it("falls back to a top-up only for the full stressed cost", () => {
    const s = { ...ledger(50_000, 10_000_000) };
    const d = decideReservation(s, { costMicros: 100_000, topupCostMicros: 220_000, meters: {} });
    expect(d).toMatchObject({ ok: true, walletMicros: 0, topupMicros: 220_000 });
    if (d.ok) {
      const released = releaseReservation(d.next, { walletMicros: 0, topupMicros: 220_000, meters: {} });
      expect(released.topupReservedMicros).toBe(0);
      expect(released.topupSpentMicros).toBe(0);
    }
  });

  it("rejects invalid reservation inputs", () => {
    expect(decideReservation(ledger(), { costMicros: -1, topupCostMicros: 0, meters: {} })).toMatchObject({ ok: false, reason: "invalid" });
    expect(decideReservation(ledger(), { costMicros: 1.5, topupCostMicros: 0, meters: {} })).toMatchObject({ ok: false, reason: "invalid" });
  });
});
