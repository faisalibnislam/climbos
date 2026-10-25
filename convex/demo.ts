import { v } from "convex/values";
import { createRng, generateSyntheticDailySeries, runForecast, addDays } from "../shared/forecasting";
import { fixtureOutput } from "./ai/fixtures";
import type { BusinessInsights, SocialPostsOutput, StrategyOutput } from "../shared/ai/tasks";
import { approvalHash, contentHash } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { upsertDailyImpl } from "./analytics";
import { uniqueSlug } from "./orgs";
import { createDemoPeriod } from "./lib/periods";
import { appError, requireUser } from "./lib/tenancy";

/**
 * Seeded Formkit demonstration workspace. EVERYTHING here is synthetic and
 * labeled "Demo data". The product facts summarize the public formkit.app
 * description; no private Formkit data, pricing, revenue or campaigns are
 * used or implied. All provider adapters in demo workspaces are fixtures.
 */

const DAY = 86_400_000;
const FACTS: { category: Doc<"businessFacts">["category"]; statement: string; confidence: "high" | "medium" | "low"; reviewState: Doc<"businessFacts">["reviewState"] }[] = [
  { category: "product", statement: "Formkit creates online forms from a plain-language description using AI.", confidence: "high", reviewState: "confirmed" },
  { category: "product", statement: "Forms support conditional logic, showing questions based on earlier answers.", confidence: "high", reviewState: "confirmed" },
  { category: "product", statement: "Forms can collect payments.", confidence: "high", reviewState: "confirmed" },
  { category: "product", statement: "Formkit can draft AI replies to form responses.", confidence: "medium", reviewState: "confirmed" },
  { category: "product", statement: "Formkit can analyze form responses.", confidence: "medium", reviewState: "confirmed" },
  { category: "audience", statement: "Likely used by small teams and solo founders who collect leads, payments or feedback.", confidence: "low", reviewState: "needs_review" },
  { category: "pricing", statement: "Pricing not confirmed: check the current pricing page before mentioning prices.", confidence: "low", reviewState: "needs_review" },
];

export const createDemoWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(20);
    for (const m of memberships) {
      const o = await ctx.db.get(m.orgId);
      if (o && o.kind === "demo" && !o.deletedAt && m.status === "active") return { slug: o.slug };
    }
    const slug = await seedDemo(ctx, user._id);
    return { slug };
  },
});

async function seedDemo(ctx: MutationCtx, userId: Id<"users">): Promise<string> {
  const now = Date.now();
  const slug = await uniqueSlug(ctx, "formkit-demo");
  const orgId = await ctx.db.insert("organizations", {
    name: "Formkit (demo)",
    slug,
    kind: "demo",
    createdBy: userId,
    timezone: "America/New_York",
    currency: "USD",
    onboardingStep: "done",
    createdAt: now,
  });
  await ctx.db.insert("memberships", { orgId, userId, role: "owner", status: "active", createdAt: now });
  const businessId = await ctx.db.insert("businesses", {
    orgId,
    name: "Formkit",
    website: "https://formkit.app",
    socialUrls: [],
    businessType: "saas",
    summary: "AI form builder: describe a form and get a working version with logic, payments and AI replies.",
    currency: "USD",
    timezone: "America/New_York",
    researchStatus: "done",
    successEvents: [
      { key: "signup", label: "Sign-up", definition: "A new account is created", confirmed: true },
      { key: "first_form_published", label: "First form published", definition: "A new account publishes its first form", confirmed: true },
      { key: "paid_conversion", label: "Upgrade to paid", definition: "An account starts a paid plan", confirmed: true },
    ],
    createdAt: now,
    updatedAt: now,
  });
  const sourceId = await ctx.db.insert("factSources", {
    orgId,
    businessId,
    kind: "demo_fixture",
    url: "https://formkit.app/",
    title: "Formkit homepage (public description, summarized for the demo)",
    excerpt: "AI form creation, conditional logic, payments, AI replies and response analysis.",
    fetchedAt: now,
    status: "ok",
    expiresAt: now + 365 * DAY,
  });
  const factIds: Id<"businessFacts">[] = [];
  for (const f of FACTS) {
    factIds.push(
      await ctx.db.insert("businessFacts", { orgId, businessId, ...f, provenance: "demo_fixture", sourceIds: [sourceId], createdAt: now, updatedAt: now }),
    );
  }
  const confirmedFacts = FACTS.filter((f) => f.reviewState === "confirmed");
  const fx = { businessName: "Formkit", website: "https://formkit.app", facts: confirmedFacts };
  const insights = fixtureOutput("business_insights", fx) as BusinessInsights;
  await ctx.db.patch(businessId, { insights: { ...insights, competitors: insights.competitors.map((c) => ({ name: c.name, note: c.note })), generatedAt: now } });
  await ctx.db.insert("brandProfiles", { orgId, businessId, voice: "Friendly, clear and practical", toneWords: ["helpful", "quick", "plain"], colors: ["#14532d"], doNots: ["No invented statistics or testimonials", "No pricing until confirmed"], updatedAt: now });
  const goalId = await ctx.db.insert("goals", {
    orgId,
    businessId,
    kind: "more_customers",
    statement: "Help Formkit acquire more paying customers over the next 90 days.",
    horizonDays: 90,
    monthlyAdBudgetMinor: 60_000,
    currency: "USD",
    reviewDay: "Friday",
    status: "active",
    createdBy: userId,
    createdAt: now - 20 * DAY,
  });
  await ctx.db.insert("autonomyPolicies", {
    orgId,
    version: 1,
    mode: "review",
    approvalRoles: ["owner", "admin", "reviewer"],
    allowRecurringPostsUnderCalendar: false,
    allowAdPauseRules: true,
    maxMonthlyAdSpendMinor: 60_000,
    currency: "USD",
    approvalTtlHours: 72,
    createdBy: userId,
    createdAt: now - 20 * DAY,
    active: true,
  });

  // Approved growth plan v1.
  const s = fixtureOutput("growth_strategy", fx) as StrategyOutput;
  const strategyId = await ctx.db.insert("strategies", {
    orgId,
    businessId,
    goalId,
    version: 1,
    status: "approved",
    summary: s.summary,
    expert: {
      version: 7,
      diagnosis: "Fictional sample plan for demonstrating ClimbOS.",
      affordableCac: "Unknown in this demo.",
      notDoing: [],
      northStar: { metric: "Demo metric only", baseline: "Unknown", target: "Not set" },
      leadingIndicators: [],
      phases: [],
      weekOneChecklist: [],
      risks: [],
      plays: [{
        id: "demo_opportunity",
        name: "Demo opportunity",
        oneLiner: "This fictional example shows how an opportunity can be explored; it is not a recommendation for your business.",
        firstActionToday: "Ask what evidence would be needed to assess an opportunity for your business.",
        kind: "research",
      }],
    },
    audiences: s.audiences,
    positioning: s.positioning,
    channels: s.channels.map((c, i) => ({
      key: c.key,
      name: c.name,
      why: c.why,
      priority: i + 1,
      status: "active" as const,
      monthlyCostMicros: [1_200_000, 900_000, 300_000, 400_000][i] ?? 0,
      adSpendMinor: Math.round(c.suggestedMonthlyAdSpend * 100),
      deliverables: c.deliverables,
      dependencies: c.dependencies,
      measurement: c.measurement,
      capabilityNote: c.key === "search_ads" ? "Ads are created paused and only go live after you approve the exact campaign and budget." : undefined,
    })),
    constraints: s.constraints,
    measurementPlan: s.measurementPlan,
    reviewDate: new Date(now + 7 * DAY).toISOString().slice(0, 10),
    sourceFactIds: factIds.slice(0, 5),
    generationCostMicros: 0,
    createdAt: now - 19 * DAY,
  });
  for (const [i, e] of s.experiments.entries()) {
    await ctx.db.insert("experiments", { orgId, strategyId, ...e, status: i === 0 ? "running" : "proposed", createdAt: now - 18 * DAY });
  }

  // Content in every state, including an honest "uncertain" outcome.
  const posts = (fixtureOutput("social_posts", { ...fx, quantity: 6 }) as SocialPostsOutput).posts;
  const states: Doc<"artifacts">["status"][] = ["in_review", "in_review", "approved", "scheduled", "published", "uncertain"];
  const conns = await seedConnections(ctx, orgId, userId, now);
  for (const [i, p] of posts.entries()) {
    const status = states[i] ?? "draft";
    const scheduledFor = status === "scheduled" ? now + 2 * DAY : status === "published" || status === "uncertain" ? now - (i + 1) * DAY : now + (i + 3) * DAY;
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId, kind: "social_post", channel: p.channel, title: p.title, status, currentVersion: 1, scheduledFor, createdByRole: "social_media_manager", createdAt: now - (8 - i) * DAY, updatedAt: now - (6 - i) * DAY });
    const body = i === 1 ? `${p.body}\n\nGuaranteed to double your sign-ups.` : p.body;
    const ch = await contentHash({ body, hashtags: p.hashtags, altText: p.altText, channel: p.channel });
    const versionId = await ctx.db.insert("artifactVersions", {
      orgId,
      artifactId,
      version: 1,
      body,
      hashtags: p.hashtags,
      altText: p.altText,
      imagePrompt: p.imageIdea,
      claimFactIds: [factIds[i % 5]],
      unsupportedClaims: i === 1 ? ['Check claim: "Guaranteed"'] : [],
      contentHash: ch,
      editedByRole: "social_media_manager",
      createdAt: now - (8 - i) * DAY,
    });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    if (["approved", "scheduled", "published", "uncertain"].includes(status)) {
      const scope = { connectionId: p.channel === "instagram" ? conns.instagram : undefined, destination: p.channel };
      const expiresAt = now + 3 * DAY;
      const binding = { orgId, subjectType: "artifact", subjectId: artifactId, actionKind: p.channel === "instagram" ? "publish" : "export", contentHash: ch, scope, policyVersion: 1, expiresAt };
      const approvalId = await ctx.db.insert("approvals", { orgId, subjectType: "artifact", subjectId: artifactId, actionKind: binding.actionKind, title: p.title, contentHash: ch, scope, costEstimateMicros: 0, policyVersion: 1, approvalHash: await approvalHash(binding), status: status === "published" ? "consumed" : "approved", decidedBy: userId, decidedAt: now - 5 * DAY, expiresAt, createdAt: now - 5 * DAY });
      await ctx.db.patch(artifactId, { approvalId });
    }
    if (status === "published" || status === "uncertain") {
      await ctx.db.insert("actionReceipts", {
        orgId,
        artifactId,
        provider: p.channel === "instagram" ? "instagram" : "manual",
        action: p.channel === "instagram" ? "instagram.publish_media" : "export",
        idempotencyKey: `${orgId}:publish:${artifactId}:v1`,
        status: status === "published" ? "fixture_verified" : "uncertain",
        externalId: status === "published" ? "demo_post_1" : "container:demo_container_9",
        summary: status === "published" ? "Demo: simulated platform acceptance. Nothing was posted to a real account." : "Demo: the platform timed out mid-request. ClimbOS won't post again until the outcome is checked.",
        createdAt: now - (i + 1) * DAY,
      });
    }
  }
  for (const item of [
    { kind: "ad" as const, channel: "google_search_ad" as const, title: "Search ad: AI Form Builder", headline: "AI Form Builder | Forms With Payments | Build a Form in Minutes", body: "Describe your form and get a working version with logic and payments.\nCollect leads and payments. No code needed.", status: "approved" as const, role: "ads_manager" as const, url: "https://formkit.app" },
    { kind: "email_sequence" as const, channel: "email" as const, title: "First form in 7 days", headline: "3 emails · for new sign-ups who agreed to product emails", body: "Email 1 — day 0\nSubject: Your first form, in one sentence\n\nDescribe the form you need and Formkit builds it.\n\n———\n\nEmail 2 — day 2\nSubject: Add logic so your form asks the right questions\n\n———\n\nEmail 3 — day 5\nSubject: Ready to collect payments?", status: "in_review" as const, role: "customer_success_manager" as const, url: undefined },
    { kind: "blog_post" as const, channel: "blog" as const, title: "How to build a lead capture form with payments (in minutes)", headline: "Build a lead capture form with conditional logic and payments — no code.", body: "## What a good lead capture form includes\n- Only essential questions\n- Clear next step\n\n## Build it step by step\n- Describe the form\n- Add logic\n- Connect payments\n\n---\n\n(Draft — review before publishing.)", status: "draft" as const, role: "seo_specialist" as const, url: undefined },
  ]) {
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId, kind: item.kind, channel: item.channel, title: item.title, status: item.status, currentVersion: 1, createdByRole: item.role, createdAt: now - 4 * DAY, updatedAt: now - 3 * DAY });
    const ch = await contentHash({ headline: item.headline, body: item.body, destinationUrl: item.url, hashtags: [], channel: item.channel });
    const versionId = await ctx.db.insert("artifactVersions", { orgId, artifactId, version: 1, headline: item.headline, body: item.body, destinationUrl: item.url, hashtags: [], claimFactIds: [factIds[0], factIds[2]], unsupportedClaims: [], contentHash: ch, editedByRole: item.role, createdAt: now - 4 * DAY });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
  }
  await ctx.db.insert("campaigns", {
    orgId,
    strategyId,
    channel: "google_search_ad",
    name: "ClimbOS · Search test · use-case keywords",
    status: "created_paused",
    budgetEnvelopeMinor: 60_000,
    dailyBudgetMinor: 2_000,
    currency: "USD",
    startDate: new Date(now + DAY).toISOString().slice(0, 10),
    endDate: new Date(now + 30 * DAY).toISOString().slice(0, 10),
    destinationUrl: "https://formkit.app",
    stopRules: ["Pause if spend reaches 600.00 USD for this campaign", "Pause if conversion tracking stops reporting for 48 hours", "Pause immediately when you press Pause all"],
    externalId: "demo_campaign_1",
    connectionId: conns.googleAds,
    createdAt: now - 3 * DAY,
    updatedAt: now - 3 * DAY,
  });

  // Today: chat history and proposed actions.
  const cardId = await ctx.db.insert("actionCards", { orgId, title: "Draft 3 Instagram posts for next week", description: "Short demos of building a form from one sentence.", proposedEffect: "Creates drafts only. Nothing is published.", kind: "generate_content", roles: ["social_media_manager", "creative_director"], payload: JSON.stringify({ job: "content_social", channel: "instagram", quantity: 3 }), costEstimateMicros: 30_000, externalEffect: false, status: "proposed", priority: 1, createdAt: now - DAY, updatedAt: now - DAY });
  await ctx.db.insert("actionCards", { orgId, title: "Explain last month's results", description: "Plain-English summary of sign-ups and paid conversions.", proposedEffect: "Writes an explanation. No changes to anything.", kind: "analyze_results", roles: ["data_analyst"], payload: JSON.stringify({ job: "explain_results" }), costEstimateMicros: 3_000, externalEffect: false, status: "proposed", priority: 2, createdAt: now - DAY, updatedAt: now - DAY });
  await ctx.db.insert("chatMessages", { orgId, author: "user", userId, text: "Can you get a few Instagram posts ready for next week?", roles: [], actionCardIds: [], status: "done", createdAt: now - DAY - 60_000 });
  await ctx.db.insert("chatMessages", { orgId, author: "climbos", text: "Here's what I'd do. Nothing runs until you say go — the card shows what it creates and the most it can cost.", roles: ["coo"], actionCardIds: [cardId], status: "done", createdAt: now - DAY });

  await createDemoPeriod(ctx, orgId);
  // Make credit usage visible: about 40% of the month's credits used.
  const period = await ctx.db
    .query("usagePeriods")
    .withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("periodKey", "demo"))
    .unique();
  if (period) {
    await ctx.db.patch(period._id, {
      walletSpentMicros: Math.round(period.walletCapMicros * 0.41),
      meterUsed: { ...period.meterUsed, socialPosts: 34, imageAttempts: 96, deliveredImages: 51, searchCalls: 44, scrapeCredits: 120, transactionalEmails: 61 },
    });
  }
  for (const [i, a] of [
    "Demo workspace created with synthetic data.",
    "Growth plan v1 approved.",
    "6 social posts drafted by the Social Media Manager.",
    "Search ad campaign created paused (demo).",
  ].entries()) {
    await ctx.db.insert("auditEvents", { orgId, actorType: i === 1 ? "user" : "agent", action: "demo.seed", summary: a, createdAt: now - (4 - i) * DAY });
  }
  await ctx.scheduler.runAfter(0, internal.demo.seedMetrics, { orgId, startDays: 180 });
  return slug;
}

async function seedConnections(ctx: MutationCtx, orgId: Id<"organizations">, userId: Id<"users">, now: number) {
  const add = (provider: Doc<"connections">["provider"], label: string, accountType?: string) =>
    ctx.db.insert("connections", { orgId, provider, status: "connected", accountLabel: `${label} (demo)`, accountType, externalAccountId: `demo_${provider}`, scopes: [], isFixture: true, lastSyncAt: now - 3 * 3_600_000, createdBy: userId, createdAt: now - 20 * DAY, updatedAt: now });
  await add("ga4", "Formkit GA4 property");
  await add("search_console", "formkit.app");
  const instagram = await add("instagram", "@formkit_demo", "Business");
  const googleAds = await add("google_ads", "Formkit Ads account");
  await add("stripe_revenue", "Stripe (synthetic)");
  return { instagram, googleAds };
}

/** Synthetic daily metrics, revenue events and touches (scheduled to stay within transaction limits). */
export const seedMetrics = internalMutation({
  args: { orgId: v.id("organizations"), startDays: v.number() },
  handler: async (ctx, { orgId, startDays }) => {
    const org = await ctx.db.get(orgId);
    if (!org) return;
    const today = new Date().toISOString().slice(0, 10);
    const start = addDays(today, -startDays);
    const visits = generateSyntheticDailySeries({ days: startDays, startDate: start, base: 300, trendPerDay: 0.35, noiseSd: 22, seed: 11, integer: true });
    const rng = createRng(29);
    const rows: { metricKey: string; date: string; value: number }[] = [];
    const revenueEvents: Omit<Doc<"revenueEvents">, "_id" | "_creationTime">[] = [];
    const touches: Omit<Doc<"touches">, "_id" | "_creationTime">[] = [];
    const channels = ["organic search", "instagram", "email", "google ads", "referral"];
    let customer = 0;
    // Monthly renewals with churn, so retention cohorts look like a real subscription business.
    const churnRng = createRng(31);
    const todayStartMs = Date.parse(`${today}T00:00:00Z`);
    const renewalsByDate = new Map<string, number>();
    for (const p of visits) {
      const signups = rng.binomial(Math.round(p.value), 0.05);
      const paid = rng.binomial(signups, 0.08);
      let revenue = 0;
      const dayStart = Date.parse(`${p.date}T15:00:00Z`);
      for (let k = 0; k < paid; k++) {
        customer++;
        const ref = `demo_cus_${customer}`;
        const refunded = rng.uniform() < 0.03 ? 2500 : 0;
        revenueEvents.push({ orgId, source: "stripe", sourceEventId: `demo_ch_${customer}`, occurredAt: dayStart + k * 600_000, customerRef: ref, orderRef: `demo_in_${customer}`, currency: "USD", amountMinor: 2500, refundedMinor: refunded, kind: "subscription_payment", isFixture: true, ingestedAt: Date.now() });
        revenue += 2500 - refunded;
        if (!refunded) {
          for (let m = 1; ; m++) {
            if (churnRng.uniform() < (m === 1 ? 0.18 : 0.08)) break;
            const at = dayStart + m * 30 * DAY;
            if (at >= todayStartMs) break;
            const date = new Date(at).toISOString().slice(0, 10);
            revenueEvents.push({ orgId, source: "stripe", sourceEventId: `demo_ch_${customer}_r${m}`, occurredAt: at + k * 600_000, customerRef: ref, orderRef: `demo_in_${customer}_r${m}`, currency: "USD", amountMinor: 2500, refundedMinor: 0, kind: "subscription_payment", isFixture: true, ingestedAt: Date.now() });
            renewalsByDate.set(date, (renewalsByDate.get(date) ?? 0) + 2500);
          }
        }
        if (rng.uniform() < 0.72) {
          const ch = channels[Math.floor(rng.uniform() * channels.length)];
          touches.push({ orgId, customerRef: ref, source: "stripe", occurredAt: dayStart - Math.floor(rng.uniform() * 5) * DAY - 3_600_000, channel: ch, utmSource: ch.split(" ")[0], utmMedium: ch === "google ads" ? "cpc" : ch === "email" ? "email" : "organic", isFixture: true });
        }
      }
      rows.push({ metricKey: "visits", date: p.date, value: p.value }, { metricKey: "signups", date: p.date, value: signups }, { metricKey: "paid_conversions", date: p.date, value: paid }, { metricKey: "revenue", date: p.date, value: revenue });
    }
    for (const r of rows) if (r.metricKey === "revenue") r.value += renewalsByDate.get(r.date) ?? 0;
    await upsertDailyImpl(ctx, orgId, "demo synthetic", "observed", rows, true);
    for (const e of revenueEvents) await ctx.db.insert("revenueEvents", e);
    for (const t of touches) await ctx.db.insert("touches", t);
    // Ad-platform claims for the last 30 days (overlapping, platform-reported).
    for (let d = 30; d >= 1; d--) {
      const date = addDays(today, -d);
      await ctx.db.insert("platformClaims", { orgId, platform: "google_ads", date, conversions: rng.poisson(0.6), conversionValueMinor: 0, spendMinor: 1800 + Math.round(rng.uniform() * 400), currency: "USD", isFixture: true });
    }
    // Deterministic forecasts from the synthetic history.
    for (const metricKey of ["visits", "paid_conversions"] as const) {
      const series = rows.filter((r) => r.metricKey === metricKey).map((r) => ({ date: r.date, value: r.value }));
      const result = runForecast({ series, horizonDays: 30, method: "seasonal_naive", nonNegative: true, seed: 7 });
      const forecastId = await ctx.db.insert("forecastRuns", {
        orgId,
        metricKey,
        method: result.method,
        horizonDays: 30,
        status: result.status,
        result: JSON.stringify({ points: result.points, calibration: result.calibration, assumptions: result.assumptions, warnings: ["Demo data is synthetic.", ...result.warnings] }),
        dataThrough: series[series.length - 1]?.date,
        historyDays: series.length,
        isFixture: true,
        createdAt: Date.now(),
      });
      if (result.backtest) await ctx.db.insert("backtestRuns", { orgId, forecastRunId: forecastId, metricKey, result: JSON.stringify(result.backtest), createdAt: Date.now() });
    }
  },
});

/** Cron: remove demo workspaces older than 7 days. */
export const expireDemos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query("organizations")
      .withIndex("by_kind_created", (q) => q.eq("kind", "demo").lt("createdAt", Date.now() - 7 * DAY))
      .take(20);
    for (const o of old) {
      if (o.deletedAt) continue;
      await ctx.db.patch(o._id, { deletedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.settings.purgeWorkspaceBatch, { orgId: o._id });
    }
    return old.length;
  },
});

export const resetDemo = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const user = await requireUser(ctx);
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org || org.kind !== "demo") throw appError("INVALID", "Only demo workspaces can be reset.");
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", user._id))
      .unique();
    if (!m || m.status !== "active") throw appError("NOT_FOUND", "We couldn't find that workspace.");
    await ctx.db.patch(org._id, { deletedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.settings.purgeWorkspaceBatch, { orgId: org._id });
    const newSlug = await seedDemo(ctx, user._id);
    return { slug: newSlug };
  },
});
