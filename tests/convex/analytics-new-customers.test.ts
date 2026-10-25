import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

const DAY = 86_400_000;

describe("first recorded paying customers", () => {
  it("gives the strategy job tenant-scoped observed subscription cohorts without mixing one-off or fixture payments", async () => {
    const t = setup();
    const owner = await asNewUser(t, "strategy-subscription-cohorts@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Subscription Cohort Co" });
    const other = await asNewUser(t, "other-strategy-subscription-cohorts@example.com");
    const otherWorkspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Subscription Co" });
    const now = Date.now();
    const runId = await t.run(async (ctx) => {
      const org = orgId as Id<"organizations">;
      const otherOrg = otherWorkspace.orgId as Id<"organizations">;
      const insert = (workspace: Id<"organizations">, id: string, month: string, customerRef: string, kind: "subscription_payment" | "order", isFixture = false) => ctx.db.insert("revenueEvents", {
        orgId: workspace,
        source: "csv",
        sourceEventId: id,
        occurredAt: Date.parse(`${month}-15T12:00:00Z`),
        customerRef,
        orderRef: id,
        currency: "USD",
        amountMinor: 5_000,
        refundedMinor: 0,
        kind,
        isFixture,
        ingestedAt: now,
      });
      await insert(org, "sub-a-mar", "2026-03", "sub-a", "subscription_payment");
      await insert(org, "sub-a-apr", "2026-04", "sub-a", "subscription_payment");
      await insert(org, "sub-b-mar", "2026-03", "sub-b", "subscription_payment");
      await insert(org, "one-off-apr", "2026-04", "one-off", "order");
      await insert(org, "fixture-apr", "2026-04", "fixture-user", "subscription_payment", true);
      await insert(otherOrg, "other-sub-apr", "2026-04", "other-user", "subscription_payment");
      return ctx.db.insert("workflowRuns", { orgId: org, kind: "strategy", title: "Plan", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now });
    });
    const context = await t.query(internal.jobWrites.jobContext, { runId });
    expect(context?.subscriptionCohortText).toContain("2026-03: 2 first-paid customers; M1 1/2 (50.0%)");
    expect(context?.subscriptionCohortText).not.toContain("one-off");
    expect(context?.subscriptionCohortText).not.toContain("other-user");
    expect(context?.subscriptionCohortText).toContain("observed payer retention, not contractual churn");
  });

  it("shows only identified GA4 AI-assistant referral sources in the workspace results", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ai-referrals@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "AI Referral Co" });
    const other = await asNewUser(t, "other-ai-referrals@example.com");
    const otherWorkspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other AI Referral Co" });
    const date = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10);
    await t.mutation(internal.analytics.upsertDaily, {
      orgId: orgId as Id<"organizations">,
      source: "ga4",
      kind: "observed",
      rows: [
        { metricKey: "ai_referral_sessions", date, value: 12, channel: "AI referral / ChatGPT" },
        { metricKey: "ai_referral_key_events", date, value: 2, channel: "AI referral / ChatGPT" },
        { metricKey: "ai_referral_sessions", date, value: 5, channel: "AI referral / Perplexity" },
        { metricKey: "ai_referral_key_events", date, value: 1, channel: "AI referral / Perplexity" },
        { metricKey: "ai_referral_sessions", date, value: 900, channel: "AI referral / Google" },
      ],
    });
    await t.mutation(internal.analytics.upsertDaily, {
      orgId: otherWorkspace.orgId as Id<"organizations">,
      source: "ga4",
      kind: "observed",
      rows: [{ metricKey: "ai_referral_sessions", date, value: 300, channel: "AI referral / ChatGPT" }],
    });

    const overview = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    expect(overview?.aiReferrals).toMatchObject({ sessions: 17, keyEvents: 3 });
    expect(overview?.aiReferrals.providers).toEqual([
      expect.objectContaining({ provider: "ChatGPT", sessions: 12, keyEvents: 2 }),
      expect.objectContaining({ provider: "Perplexity", sessions: 5, keyEvents: 1 }),
    ]);
    expect(overview?.aiReferrals.note).toContain("Google Search AI feature visibility is not classified here");
  });

  it("imports owner-reported ad spend with currency precision and safely replaces the same day", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ad-spend-import@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Spend Co" });
    const other = await asNewUser(t, "other-ad-spend-import@example.com");
    await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Spend Co" });
    await t.run(async (ctx) => ctx.db.insert("platformClaims", {
      orgId,
      platform: "google_ads",
      date: "2026-10-23",
      conversions: 1,
      conversionValueMinor: 1000,
      spendMinor: 1000,
      currency: "USD",
      spendOrigin: "platform_reported",
      isFixture: false,
    }));
    const input = { slug, rows: [{ platform: "google_ads" as const, date: "2026-10-23", conversions: 3, conversionValue: 240.5, spend: 60.25, currency: "USD" }] };
    await expect(owner.client.mutation(api.analytics.importPlatformClaims, { ...input, rows: [...input.rows, ...input.rows] })).rejects.toThrow(/duplicate platform/);
    await expect(other.client.mutation(api.analytics.importPlatformClaims, input)).rejects.toThrow();
    await expect(owner.client.mutation(api.analytics.importPlatformClaims, { ...input, rows: [{ ...input.rows[0], date: "2026-02-30" }] })).rejects.toThrow(/real calendar date/);
    await owner.client.mutation(api.analytics.importPlatformClaims, input);
    await owner.client.mutation(api.analytics.importPlatformClaims, { ...input, rows: [{ ...input.rows[0], spend: 75.3 }] });
    await owner.client.mutation(api.analytics.importPlatformClaims, {
      slug,
      rows: [{ platform: "meta_ads", date: "2026-10-22", conversions: 1, conversionValue: 90, spend: 25.5, currency: "EUR" }],
    });

    const rows = await t.run(async (ctx) => ctx.db.query("platformClaims").withIndex("by_org_platform_date", (q) => q.eq("orgId", orgId).eq("platform", "google_ads").eq("date", "2026-10-23")).collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ conversions: 3, conversionValueMinor: 24_050, spendMinor: 7_530, currency: "USD", spendOrigin: "owner_reported", isFixture: false });
    const overview = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    expect(overview?.platformClaims).toMatchObject({ adSpendMinor: 7_530, adSpendByCurrency: { USD: 7_530, EUR: 2_550 } });
  });

  it("counts an identified customer once, not again for renewals or duplicate same-day payments", async () => {
    const t = setup();
    const owner = await asNewUser(t, "first-payer@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "First Payer Co" });
    const now = Date.now();
    const events = [
      { source: "csv", sourceEventId: "c1-first", occurredAt: now - 4 * DAY, customerRef: "customer-1", currency: "USD", amountMinor: 10_000, refundedMinor: 0, kind: "order" as const },
      { source: "csv", sourceEventId: "c1-renewal", occurredAt: now - DAY, customerRef: "customer-1", currency: "USD", amountMinor: 10_000, refundedMinor: 0, kind: "subscription_payment" as const },
      { source: "csv", sourceEventId: "c2-first", occurredAt: now - DAY, customerRef: "customer-2", currency: "USD", amountMinor: 5_000, refundedMinor: 0, kind: "order" as const },
      { source: "csv", sourceEventId: "c2-second", occurredAt: now - DAY, customerRef: "customer-2", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order" as const },
      { source: "csv", sourceEventId: "unknown-customer", occurredAt: now - DAY, currency: "USD", amountMinor: 2_500, refundedMinor: 0, kind: "order" as const },
    ];

    await t.mutation(internal.analytics.ingestRevenue, { orgId: orgId as Id<"organizations">, events });
    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const metric = view!.metrics.find((m) => m.key === "paid_conversions")!;

    expect(metric.total).toBe(2);
    expect(metric.hasData).toBe(true);
    expect(metric.label).toBe("First recorded paying customers");
    expect(metric.definition).toMatch(/without a customer ID are excluded/);
    expect(metric.points.reduce((sum, point) => sum + point.value, 0)).toBe(2);
  });

  it("does not report customer counts when imported payments have no customer IDs", async () => {
    const t = setup();
    const owner = await asNewUser(t, "unknown-payer@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Unknown Payer Co" });
    await t.mutation(internal.analytics.ingestRevenue, {
      orgId: orgId as Id<"organizations">,
      events: [{ source: "csv", sourceEventId: "no-id", occurredAt: Date.now() - DAY, currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order" }],
    });

    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const metric = view!.metrics.find((m) => m.key === "paid_conversions")!;

    expect(metric.hasData).toBe(false);
    expect(metric.total).toBe(0);
    expect(metric.sourceName).toBeNull();
  });

  it("does not report paying-customer data for a refund-only window", async () => {
    const t = setup();
    const owner = await asNewUser(t, "refund-only@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Refund Only Co" });
    await t.mutation(internal.analytics.ingestRevenue, {
      orgId: orgId as Id<"organizations">,
      events: [{ source: "stripe", sourceEventId: "refund-only", occurredAt: Date.now() - DAY, customerRef: "customer-1", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "refund" }],
    });

    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const metric = view!.metrics.find((m) => m.key === "paid_conversions")!;
    expect(metric.hasData).toBe(false);
    expect(metric.total).toBe(0);
    expect(metric.sourceName).toBeNull();
  });

  it("keeps identical provider customer IDs separate instead of merging unrelated billing customers", async () => {
    const t = setup();
    const owner = await asNewUser(t, "provider-ids@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Provider IDs Co" });
    const now = Date.now();

    await t.mutation(internal.analytics.ingestRevenue, {
      orgId: orgId as Id<"organizations">,
      events: [
        { source: "stripe", sourceEventId: "stripe-event", occurredAt: now - DAY, customerRef: "customer-7", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order" },
        { source: "polar", sourceEventId: "polar-event", occurredAt: now - DAY, customerRef: "customer-7", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order" },
      ],
    });

    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const metric = view!.metrics.find((m) => m.key === "paid_conversions")!;
    expect(metric.total).toBe(2);
    expect(metric.definition).toMatch(/source-scoped customer IDs/);
    expect(metric.definition).toMatch(/same person across billing systems may count more than once/);
  });

  it("does not cross-attribute UTMs when two billing providers reuse the same customer and order IDs", async () => {
    const t = setup();
    const owner = await asNewUser(t, "provider-attribution@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Provider Attribution Co" });
    const now = Date.now();

    await t.mutation(internal.analytics.ingestRevenue, {
      orgId: orgId as Id<"organizations">,
      events: [
        { source: "stripe", sourceEventId: "stripe-event", occurredAt: now - DAY, customerRef: "customer-7", orderRef: "order-1", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order", utmSource: "google", utmMedium: "cpc" },
        { source: "polar", sourceEventId: "polar-event", occurredAt: now - DAY, customerRef: "customer-7", orderRef: "order-1", currency: "USD", amountMinor: 2_000, refundedMinor: 0, kind: "order", utmSource: "meta", utmMedium: "cpc" },
      ],
    });

    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const channels = view!.attribution.lastTouch!.byCurrency[0].channels;
    expect(channels).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: "google ads", netRevenueMinor: 1_000 }),
      expect.objectContaining({ channel: "meta ads", netRevenueMinor: 2_000 }),
    ]));
  });
});
