import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ClimbOS data model. Every tenant-owned table carries `orgId` and is indexed
 * by it first. Queries must go through the guards in `lib/tenancy.ts`; no
 * client-supplied orgId is trusted without a membership check.
 */

export const roleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("editor"),
  v.literal("reviewer"),
  v.literal("viewer"),
);

export const planKeyValidator = v.union(
  v.literal("basic"),
  v.literal("starter"),
  v.literal("growth"),
  v.literal("pro"),
  v.literal("business"),
);

export const agentRoleValidator = v.union(
  v.literal("ceo"),
  v.literal("coo"),
  v.literal("cmo"),
  v.literal("cso"),
  v.literal("creative_director"),
  v.literal("social_media_manager"),
  v.literal("ads_manager"),
  v.literal("seo_specialist"),
  v.literal("data_analyst"),
  v.literal("customer_success_manager"),
);

export const autonomyValidator = v.union(
  v.literal("copilot"),
  v.literal("review"),
  v.literal("bounded_autopilot"),
);

export const runStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("cost_reserved"),
  v.literal("preparing"),
  v.literal("needs_approval"),
  v.literal("approved"),
  v.literal("scheduled"),
  v.literal("executing"),
  v.literal("verified"),
  v.literal("failed"),
  v.literal("uncertain"),
  v.literal("paused"),
  v.literal("canceled"),
);

export const providerValidator = v.union(
  v.literal("website"),
  v.literal("ga4"),
  v.literal("search_console"),
  v.literal("google_ads"),
  v.literal("meta_ads"),
  v.literal("facebook_pages"),
  v.literal("instagram"),
  v.literal("email_resend"),
  v.literal("stripe_revenue"),
  v.literal("csv_revenue"),
  v.literal("linkedin"),
  v.literal("x"),
  v.literal("tiktok"),
  v.literal("pinterest"),
  v.literal("youtube"),
  v.literal("crm_csv"),
  v.literal("enrichment"),
);

export const capabilityStateValidator = v.union(
  v.literal("ready"),
  v.literal("approval_needed"),
  v.literal("provider_review_pending"),
  v.literal("unsupported_account_type"),
  v.literal("sync_delayed"),
  v.literal("action_required"),
  v.literal("setup_needed"),
  v.literal("unavailable"),
);

export const artifactKindValidator = v.union(
  v.literal("social_post"),
  v.literal("ad"),
  v.literal("email"),
  v.literal("email_sequence"),
  v.literal("landing_copy"),
  v.literal("blog_post"),
  v.literal("seo_brief"),
  v.literal("product_description"),
  v.literal("video_script"),
  v.literal("sales_sequence"),
);

export const channelValidator = v.union(
  v.literal("instagram"),
  v.literal("facebook"),
  v.literal("linkedin"),
  v.literal("x"),
  v.literal("tiktok"),
  v.literal("pinterest"),
  v.literal("youtube"),
  v.literal("google_search_ad"),
  v.literal("meta_ad"),
  v.literal("linkedin_ad"),
  v.literal("email"),
  v.literal("website"),
  v.literal("blog"),
);

export const artifactStatusValidator = v.union(
  v.literal("draft"),
  v.literal("in_review"),
  v.literal("approved"),
  v.literal("scheduled"),
  v.literal("publishing"),
  v.literal("published"),
  v.literal("exported"),
  v.literal("failed"),
  v.literal("uncertain"),
  v.literal("archived"),
);

const usageMeters = v.object({
  socialPosts: v.number(),
  imageAttempts: v.number(),
  deliveredImages: v.number(),
  searchCalls: v.number(),
  scrapeCredits: v.number(),
  transactionalEmails: v.number(),
  byoMarketingSends: v.number(),
  analyticsEvents: v.number(),
  supportMinutes: v.number(),
});

export default defineSchema({
  ...authTables,

  /* ---------------- Tenancy ---------------- */
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    kind: v.union(v.literal("customer"), v.literal("demo")),
    createdBy: v.id("users"),
    timezone: v.string(),
    currency: v.string(),
    onboardingStep: v.union(
      v.literal("business"),
      v.literal("research"),
      v.literal("facts"),
      v.literal("goal"),
      v.literal("preferences"),
      v.literal("plan"),
      v.literal("done"),
    ),
    emergencyStop: v.optional(
      v.object({ active: v.boolean(), at: v.number(), by: v.id("users"), reason: v.optional(v.string()) }),
    ),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_kind_created", ["kind", "createdAt"]),

  memberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    role: roleValidator,
    status: v.union(v.literal("active"), v.literal("invited"), v.literal("removed")),
    invitedEmail: v.optional(v.string()),
    inviteTokenHash: v.optional(v.string()),
    invitedBy: v.optional(v.id("users")),
    inviteExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_email", ["orgId", "invitedEmail"])
    .index("by_invite_token", ["inviteTokenHash"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    digest: v.union(v.literal("daily"), v.literal("weekly"), v.literal("off")),
    usageAlerts: v.boolean(),
    lastDigestAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  /* ---------------- Business intelligence ---------------- */
  businesses: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    website: v.optional(v.string()),
    socialUrls: v.array(v.string()),
    businessType: v.union(
      v.literal("saas"),
      v.literal("ecommerce"),
      v.literal("services"),
      v.literal("physical_products"),
      v.literal("other"),
    ),
    summary: v.optional(v.string()),
    currency: v.string(),
    timezone: v.string(),
    researchStatus: v.union(
      v.literal("not_started"),
      v.literal("running"),
      v.literal("done"),
      v.literal("partial"),
      v.literal("failed"),
      v.literal("owner_supplied"),
    ),
    successEvents: v.array(
      v.object({ key: v.string(), label: v.string(), definition: v.string(), confirmed: v.boolean() }),
    ),
    insights: v.optional(
      v.object({
        audiences: v.array(v.object({ name: v.string(), description: v.string(), confidence: v.string() })),
        competitors: v.array(
          v.object({ name: v.string(), url: v.optional(v.string()), note: v.string(), sourceUrl: v.optional(v.string()) }),
        ),
        positioning: v.string(),
        pricingNotes: v.string(),
        swot: v.object({
          strengths: v.array(v.string()),
          weaknesses: v.array(v.string()),
          opportunities: v.array(v.string()),
          threats: v.array(v.string()),
        }),
        journey: v.array(v.object({ stage: v.string(), observation: v.string(), opportunity: v.string() })),
        opportunities: v.array(v.object({ title: v.string(), why: v.string(), effort: v.string() })),
        generatedAt: v.number(),
        runId: v.optional(v.id("workflowRuns")),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),

  businessFacts: defineTable({
    orgId: v.id("organizations"),
    businessId: v.id("businesses"),
    category: v.union(
      v.literal("product"),
      v.literal("audience"),
      v.literal("pricing"),
      v.literal("brand"),
      v.literal("offer"),
      v.literal("proof"),
      v.literal("competitor"),
      v.literal("other"),
    ),
    statement: v.string(),
    confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    reviewState: v.union(
      v.literal("needs_review"),
      v.literal("confirmed"),
      v.literal("edited"),
      v.literal("rejected"),
    ),
    provenance: v.union(v.literal("researched"), v.literal("owner_supplied"), v.literal("demo_fixture")),
    sourceIds: v.array(v.id("factSources")),
    updatedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_org_state", ["orgId", "reviewState"]),

  factSources: defineTable({
    orgId: v.id("organizations"),
    businessId: v.id("businesses"),
    kind: v.union(
      v.literal("website"),
      v.literal("search"),
      v.literal("owner_text"),
      v.literal("owner_upload"),
      v.literal("demo_fixture"),
    ),
    url: v.optional(v.string()),
    title: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    fetchedAt: v.number(),
    status: v.union(v.literal("ok"), v.literal("blocked_by_robots"), v.literal("failed"), v.literal("skipped")),
    expiresAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_expires", ["expiresAt"]),

  goals: defineTable({
    orgId: v.id("organizations"),
    businessId: v.id("businesses"),
    kind: v.union(
      v.literal("more_sales"),
      v.literal("more_customers"),
      v.literal("more_reach"),
      v.literal("custom"),
    ),
    statement: v.string(),
    horizonDays: v.number(),
    monthlyAdBudgetMinor: v.number(),
    currency: v.string(),
    reviewDay: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_org_status", ["orgId", "status"]),

  brandProfiles: defineTable({
    orgId: v.id("organizations"),
    businessId: v.id("businesses"),
    voice: v.string(),
    toneWords: v.array(v.string()),
    colors: v.array(v.string()),
    doNots: v.array(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  }).index("by_business", ["businessId"]),

  /* ---------------- Connections ---------------- */
  connections: defineTable({
    orgId: v.id("organizations"),
    provider: providerValidator,
    status: v.union(
      v.literal("not_connected"),
      v.literal("connecting"),
      v.literal("connected"),
      v.literal("action_required"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    accountLabel: v.optional(v.string()),
    externalAccountId: v.optional(v.string()),
    accountType: v.optional(v.string()),
    scopes: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    isFixture: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_provider", ["orgId", "provider"])
    .index("by_expires", ["expiresAt"]),

  connectionSecrets: defineTable({
    orgId: v.id("organizations"),
    connectionId: v.id("connections"),
    kind: v.union(v.literal("oauth"), v.literal("api_key")),
    keyId: v.string(),
    iv: v.string(),
    ciphertext: v.string(),
    createdAt: v.number(),
    rotatedAt: v.optional(v.number()),
  }).index("by_connection", ["connectionId"]),

  connectionCapabilities: defineTable({
    orgId: v.id("organizations"),
    connectionId: v.optional(v.id("connections")),
    provider: providerValidator,
    capability: v.string(),
    state: capabilityStateValidator,
    reason: v.string(),
    fix: v.optional(v.string()),
    checkedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_provider", ["orgId", "provider"]),

  oauthStates: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: providerValidator,
    stateHash: v.string(),
    codeVerifier: v.optional(v.string()),
    expiresAt: v.number(),
  }).index("by_state", ["stateHash"]),

  /* ---------------- Consent and contacts ---------------- */
  contacts: defineTable({
    orgId: v.id("organizations"),
    emailHash: v.string(),
    emailCiphertext: v.optional(v.string()),
    emailIv: v.optional(v.string()),
    emailDomain: v.string(),
    displayName: v.optional(v.string()),
    source: v.union(
      v.literal("csv_import"),
      v.literal("crm"),
      v.literal("signup_form"),
      v.literal("enrichment"),
      v.literal("demo_fixture"),
    ),
    segments: v.array(v.string()),
    leadScore: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_email", ["orgId", "emailHash"]),

  consentRecords: defineTable({
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    purpose: v.union(v.literal("marketing_email"), v.literal("product_updates"), v.literal("sales_outreach")),
    basis: v.union(v.literal("opt_in"), v.literal("existing_customer"), v.literal("other_documented")),
    source: v.string(),
    evidence: v.string(),
    capturedAt: v.number(),
    withdrawnAt: v.optional(v.number()),
  }).index("by_org_contact", ["orgId", "contactId"]),

  suppressions: defineTable({
    orgId: v.id("organizations"),
    emailHash: v.string(),
    reason: v.union(
      v.literal("unsubscribe"),
      v.literal("bounce"),
      v.literal("complaint"),
      v.literal("manual"),
      v.literal("deletion"),
    ),
    source: v.string(),
    createdAt: v.number(),
  }).index("by_org_email", ["orgId", "emailHash"]),

  /* ---------------- Strategy ---------------- */
  strategies: defineTable({
    orgId: v.id("organizations"),
    businessId: v.id("businesses"),
    goalId: v.id("goals"),
    version: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("needs_approval"),
      v.literal("approved"),
      v.literal("superseded"),
    ),
    summary: v.string(),
    audiences: v.array(v.object({ name: v.string(), hypothesis: v.string(), evidence: v.string() })),
    positioning: v.string(),
    channels: v.array(
      v.object({
        key: v.string(),
        name: v.string(),
        why: v.string(),
        priority: v.number(),
        status: v.union(v.literal("proposed"), v.literal("active"), v.literal("parked")),
        monthlyCostMicros: v.number(),
        adSpendMinor: v.number(),
        deliverables: v.array(v.string()),
        dependencies: v.array(v.string()),
        measurement: v.string(),
        capabilityNote: v.optional(v.string()),
      }),
    ),
    constraints: v.array(v.string()),
    measurementPlan: v.string(),
    reviewDate: v.string(),
    sourceFactIds: v.array(v.id("businessFacts")),
    generationCostMicros: v.number(),
    runId: v.optional(v.id("workflowRuns")),
    approvalId: v.optional(v.id("approvals")),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  experiments: defineTable({
    orgId: v.id("organizations"),
    strategyId: v.id("strategies"),
    name: v.string(),
    hypothesis: v.string(),
    population: v.string(),
    method: v.union(
      v.literal("holdout"),
      v.literal("ab_split"),
      v.literal("pre_post_observational"),
      v.literal("export_instructions"),
    ),
    primaryMetric: v.string(),
    guardrails: v.array(v.string()),
    durationDays: v.number(),
    stoppingRule: v.string(),
    status: v.union(
      v.literal("proposed"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("concluded"),
    ),
    resultNote: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  campaigns: defineTable({
    orgId: v.id("organizations"),
    strategyId: v.optional(v.id("strategies")),
    channel: channelValidator,
    name: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("needs_approval"),
      v.literal("created_paused"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("ended"),
      v.literal("uncertain"),
    ),
    budgetEnvelopeMinor: v.number(),
    dailyBudgetMinor: v.optional(v.number()),
    currency: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    destinationUrl: v.optional(v.string()),
    audience: v.optional(v.string()),
    stopRules: v.array(v.string()),
    externalId: v.optional(v.string()),
    connectionId: v.optional(v.id("connections")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),

  /* ---------------- Content ---------------- */
  artifacts: defineTable({
    orgId: v.id("organizations"),
    businessId: v.id("businesses"),
    campaignId: v.optional(v.id("campaigns")),
    kind: artifactKindValidator,
    channel: channelValidator,
    title: v.string(),
    status: artifactStatusValidator,
    currentVersionId: v.optional(v.id("artifactVersions")),
    currentVersion: v.number(),
    scheduledFor: v.optional(v.number()),
    approvalId: v.optional(v.id("approvals")),
    createdByRole: v.optional(agentRoleValidator),
    createdBy: v.optional(v.id("users")),
    runId: v.optional(v.id("workflowRuns")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_updated", ["orgId", "updatedAt"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_scheduled", ["orgId", "scheduledFor"]),

  artifactVersions: defineTable({
    orgId: v.id("organizations"),
    artifactId: v.id("artifacts"),
    version: v.number(),
    headline: v.optional(v.string()),
    body: v.string(),
    callToAction: v.optional(v.string()),
    destinationUrl: v.optional(v.string()),
    hashtags: v.array(v.string()),
    altText: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    imagePrompt: v.optional(v.string()),
    imageLabel: v.optional(v.string()),
    claimFactIds: v.array(v.id("businessFacts")),
    unsupportedClaims: v.array(v.string()),
    contentHash: v.string(),
    editedByUser: v.optional(v.id("users")),
    editedByRole: v.optional(agentRoleValidator),
    createdAt: v.number(),
  }).index("by_artifact", ["artifactId", "version"]),

  /* ---------------- Approvals and policy ---------------- */
  approvals: defineTable({
    orgId: v.id("organizations"),
    subjectType: v.union(
      v.literal("artifact"),
      v.literal("strategy"),
      v.literal("campaign_activation"),
      v.literal("email_send"),
      v.literal("budget_change"),
      v.literal("action_card"),
    ),
    subjectId: v.string(),
    actionKind: v.string(),
    title: v.string(),
    contentHash: v.string(),
    scope: v.object({
      connectionId: v.optional(v.string()),
      destination: v.optional(v.string()),
      audience: v.optional(v.string()),
      spendLimitMinor: v.optional(v.number()),
      currency: v.optional(v.string()),
      windowStart: v.optional(v.number()),
      windowEnd: v.optional(v.number()),
    }),
    costEstimateMicros: v.number(),
    policyVersion: v.number(),
    approvalHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("invalidated"),
      v.literal("expired"),
      v.literal("consumed"),
    ),
    requestedBy: v.optional(v.id("users")),
    decidedBy: v.optional(v.id("users")),
    decidedAt: v.optional(v.number()),
    decisionNote: v.optional(v.string()),
    expiresAt: v.number(),
    invalidatedReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org_status", ["orgId", "status"])
    .index("by_subject", ["subjectType", "subjectId"]),

  autonomyPolicies: defineTable({
    orgId: v.id("organizations"),
    version: v.number(),
    mode: autonomyValidator,
    approvalRoles: v.array(roleValidator),
    allowRecurringPostsUnderCalendar: v.boolean(),
    allowAdPauseRules: v.boolean(),
    maxMonthlyAdSpendMinor: v.number(),
    currency: v.string(),
    quietHours: v.optional(v.object({ start: v.number(), end: v.number() })),
    approvalTtlHours: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    active: v.boolean(),
  }).index("by_org_active", ["orgId", "active"]),

  /* ---------------- Chat and action cards ---------------- */
  chatMessages: defineTable({
    orgId: v.id("organizations"),
    author: v.union(v.literal("user"), v.literal("climbos")),
    userId: v.optional(v.id("users")),
    text: v.string(),
    roles: v.array(agentRoleValidator),
    actionCardIds: v.array(v.id("actionCards")),
    status: v.union(v.literal("done"), v.literal("thinking"), v.literal("failed")),
    createdAt: v.number(),
  }).index("by_org_created", ["orgId", "createdAt"]),

  actionCards: defineTable({
    orgId: v.id("organizations"),
    title: v.string(),
    description: v.string(),
    proposedEffect: v.string(),
    kind: v.union(
      v.literal("generate_content"),
      v.literal("refresh_plan"),
      v.literal("research"),
      v.literal("analyze_results"),
      v.literal("schedule_content"),
      v.literal("ad_change"),
      v.literal("email_send"),
      v.literal("connect_account"),
      v.literal("note"),
    ),
    roles: v.array(agentRoleValidator),
    payload: v.string(),
    costEstimateMicros: v.number(),
    externalEffect: v.boolean(),
    status: v.union(
      v.literal("proposed"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("blocked"),
    ),
    blockedReason: v.optional(v.string()),
    runId: v.optional(v.id("workflowRuns")),
    priority: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org_status", ["orgId", "status"]),

  /* ---------------- Workflow engine ---------------- */
  workflowRuns: defineTable({
    orgId: v.id("organizations"),
    kind: v.string(),
    title: v.string(),
    status: runStatusValidator,
    input: v.string(),
    output: v.optional(v.string()),
    roles: v.array(agentRoleValidator),
    estimateMicros: v.number(),
    actualMicros: v.number(),
    reservationId: v.optional(v.id("usageReservations")),
    rateVersionId: v.string(),
    entitlementVersionId: v.string(),
    routingVersionId: v.string(),
    budget: v.object({ modelSteps: v.number(), researchTools: v.number(), repairs: v.number() }),
    used: v.object({ modelSteps: v.number(), researchTools: v.number(), repairs: v.number() }),
    isFixture: v.boolean(),
    error: v.optional(v.string()),
    userMessage: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_status_updated", ["status", "updatedAt"]),

  workflowSteps: defineTable({
    orgId: v.id("organizations"),
    runId: v.id("workflowRuns"),
    index: v.number(),
    kind: v.union(
      v.literal("model"),
      v.literal("research"),
      v.literal("image"),
      v.literal("provider_write"),
      v.literal("compute"),
    ),
    role: v.optional(agentRoleValidator),
    label: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("uncertain"),
      v.literal("skipped"),
    ),
    idempotencyKey: v.string(),
    attempt: v.number(),
    leaseUntil: v.optional(v.number()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    costMicros: v.number(),
    /** Checkpointed step output (JSON) so a resumed run skips completed steps. */
    output: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_run", ["runId", "index"])
    .index("by_idempotency", ["idempotencyKey"]),

  actionReceipts: defineTable({
    orgId: v.id("organizations"),
    runId: v.optional(v.id("workflowRuns")),
    artifactId: v.optional(v.id("artifacts")),
    campaignId: v.optional(v.id("campaigns")),
    provider: v.string(),
    action: v.string(),
    idempotencyKey: v.string(),
    status: v.union(
      v.literal("verified"),
      v.literal("failed"),
      v.literal("uncertain"),
      v.literal("fixture_verified"),
      v.literal("exported"),
    ),
    externalId: v.optional(v.string()),
    summary: v.string(),
    createdAt: v.number(),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_idempotency", ["idempotencyKey"]),

  /* ---------------- Usage and cost ledger ---------------- */
  usagePeriods: defineTable({
    orgId: v.id("organizations"),
    periodKey: v.string(),
    source: v.union(v.literal("subscription"), v.literal("onboarding"), v.literal("demo")),
    planKey: v.optional(planKeyValidator),
    entitlementVersionId: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    walletCapMicros: v.number(),
    walletReservedMicros: v.number(),
    walletSpentMicros: v.number(),
    topupCapMicros: v.number(),
    topupReservedMicros: v.number(),
    topupSpentMicros: v.number(),
    meterCaps: usageMeters,
    meterUsed: usageMeters,
    meterReserved: usageMeters,
    alertsSent: v.array(v.string()),
    grantedByOrderId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_period", ["orgId", "periodKey"])
    .index("by_org_ends", ["orgId", "endsAt"]),

  usageReservations: defineTable({
    orgId: v.id("organizations"),
    periodId: v.id("usagePeriods"),
    runId: v.optional(v.id("workflowRuns")),
    purpose: v.string(),
    walletMicros: v.number(),
    topupMicros: v.number(),
    meters: v.object({
      socialPosts: v.optional(v.number()),
      imageAttempts: v.optional(v.number()),
      deliveredImages: v.optional(v.number()),
      searchCalls: v.optional(v.number()),
      scrapeCredits: v.optional(v.number()),
      transactionalEmails: v.optional(v.number()),
      byoMarketingSends: v.optional(v.number()),
      analyticsEvents: v.optional(v.number()),
      supportMinutes: v.optional(v.number()),
    }),
    status: v.union(v.literal("held"), v.literal("reconciled"), v.literal("released"), v.literal("unresolved")),
    actualMicros: v.optional(v.number()),
    createdAt: v.number(),
    reconciledAt: v.optional(v.number()),
  })
    .index("by_org_status", ["orgId", "status"])
    .index("by_period", ["periodId"])
    .index("by_status_created", ["status", "createdAt"]),

  usageEvents: defineTable({
    orgId: v.id("organizations"),
    periodId: v.optional(v.id("usagePeriods")),
    runId: v.optional(v.id("workflowRuns")),
    stepId: v.optional(v.id("workflowSteps")),
    type: v.union(
      v.literal("model_call"),
      v.literal("image_attempt"),
      v.literal("search_call"),
      v.literal("scrape_credit"),
      v.literal("email"),
      v.literal("cache_read"),
      v.literal("cache_write"),
      v.literal("storage"),
      v.literal("preview"),
    ),
    provider: v.string(),
    model: v.optional(v.string()),
    role: v.optional(agentRoleValidator),
    inputTokens: v.number(),
    outputTokens: v.number(),
    reasoningTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
    quantity: v.number(),
    costMicros: v.number(),
    estimated: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_run", ["runId"])
    .index("by_created", ["createdAt"]),

  rateVersions: defineTable({
    versionId: v.string(),
    kind: v.union(v.literal("rates"), v.literal("entitlements"), v.literal("routing")),
    enabled: v.boolean(),
    marginGuardOk: v.boolean(),
    note: v.optional(v.string()),
    changedBy: v.optional(v.string()),
    changedAt: v.number(),
  }).index("by_version", ["versionId"]),

  /* ---------------- Billing (Polar) ---------------- */
  polarCustomers: defineTable({
    orgId: v.id("organizations"),
    polarCustomerId: v.optional(v.string()),
    email: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_polar", ["polarCustomerId"]),

  checkoutSessions: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    polarCheckoutId: v.string(),
    productKey: v.string(),
    status: v.union(v.literal("open"), v.literal("completed"), v.literal("expired")),
    createdAt: v.number(),
  })
    .index("by_polar", ["polarCheckoutId"])
    .index("by_org", ["orgId"]),

  subscriptions: defineTable({
    orgId: v.id("organizations"),
    polarSubscriptionId: v.string(),
    polarCustomerId: v.optional(v.string()),
    productId: v.string(),
    planKey: planKeyValidator,
    status: v.union(
      v.literal("incomplete"),
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("revoked"),
    ),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    endedAt: v.optional(v.number()),
    entitlementVersionId: v.string(),
    rateVersionId: v.string(),
    sourceModifiedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_polar", ["polarSubscriptionId"]),

  orders: defineTable({
    orgId: v.id("organizations"),
    polarOrderId: v.string(),
    polarSubscriptionId: v.optional(v.string()),
    productId: v.string(),
    productKey: v.string(),
    billingReason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("refunded"),
      v.literal("partially_refunded"),
    ),
    amountMinor: v.number(),
    taxMinor: v.number(),
    currency: v.string(),
    refundedMinor: v.number(),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    grantedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_polar", ["polarOrderId"])
    .index("by_org", ["orgId"]),

  creditPurchases: defineTable({
    orgId: v.id("organizations"),
    polarOrderId: v.string(),
    topupKey: v.string(),
    deliveryCostMicros: v.number(),
    periodId: v.optional(v.id("usagePeriods")),
    status: v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    createdAt: v.number(),
  })
    .index("by_order", ["polarOrderId"])
    .index("by_org", ["orgId"]),

  webhookEvents: defineTable({
    source: v.union(v.literal("polar"), v.literal("resend"), v.literal("meta"), v.literal("google")),
    eventId: v.string(),
    type: v.string(),
    payload: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    error: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_source_event", ["source", "eventId"])
    .index("by_status_received", ["status", "receivedAt"]),

  /* ---------------- Measurement ---------------- */
  metricDefinitions: defineTable({
    orgId: v.id("organizations"),
    key: v.string(),
    label: v.string(),
    definition: v.string(),
    unit: v.union(v.literal("count"), v.literal("currency_minor"), v.literal("ratio")),
    denominator: v.optional(v.string()),
    source: v.string(),
    createdAt: v.number(),
  }).index("by_org_key", ["orgId", "key"]),

  metricDaily: defineTable({
    orgId: v.id("organizations"),
    metricKey: v.string(),
    date: v.string(),
    value: v.number(),
    source: v.string(),
    kind: v.union(v.literal("observed"), v.literal("attributed"), v.literal("platform_reported")),
    channel: v.optional(v.string()),
    isFixture: v.boolean(),
    ingestedAt: v.number(),
  })
    .index("by_org_metric_date", ["orgId", "metricKey", "date"])
    .index("by_org_date", ["orgId", "date"]),

  revenueEvents: defineTable({
    orgId: v.id("organizations"),
    source: v.string(),
    sourceEventId: v.string(),
    occurredAt: v.number(),
    customerRef: v.optional(v.string()),
    orderRef: v.optional(v.string()),
    currency: v.string(),
    amountMinor: v.number(),
    refundedMinor: v.number(),
    kind: v.union(v.literal("order"), v.literal("subscription_payment"), v.literal("refund")),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    isFixture: v.boolean(),
    ingestedAt: v.number(),
  })
    .index("by_org_occurred", ["orgId", "occurredAt"])
    .index("by_org_source_event", ["orgId", "source", "sourceEventId"]),

  touches: defineTable({
    orgId: v.id("organizations"),
    customerRef: v.string(),
    occurredAt: v.number(),
    channel: v.string(),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    isFixture: v.boolean(),
  }).index("by_org_customer", ["orgId", "customerRef"]),

  platformClaims: defineTable({
    orgId: v.id("organizations"),
    platform: v.string(),
    date: v.string(),
    conversions: v.number(),
    conversionValueMinor: v.number(),
    spendMinor: v.number(),
    currency: v.string(),
    isFixture: v.boolean(),
  }).index("by_org_platform_date", ["orgId", "platform", "date"]),

  cohorts: defineTable({
    orgId: v.id("organizations"),
    cohortKey: v.string(),
    size: v.number(),
    retained: v.array(v.number()),
    isFixture: v.boolean(),
    computedAt: v.number(),
  }).index("by_org_cohort", ["orgId", "cohortKey"]),

  forecastRuns: defineTable({
    orgId: v.id("organizations"),
    metricKey: v.string(),
    method: v.string(),
    horizonDays: v.number(),
    status: v.union(
      v.literal("calibrated"),
      v.literal("insufficient_evidence"),
      v.literal("assumption_scenario"),
    ),
    result: v.string(),
    dataThrough: v.optional(v.string()),
    historyDays: v.number(),
    isFixture: v.boolean(),
    createdAt: v.number(),
  }).index("by_org_created", ["orgId", "createdAt"]),

  backtestRuns: defineTable({
    orgId: v.id("organizations"),
    forecastRunId: v.id("forecastRuns"),
    metricKey: v.string(),
    result: v.string(),
    createdAt: v.number(),
  }).index("by_forecast", ["forecastRunId"]),

  syncCursors: defineTable({
    orgId: v.id("organizations"),
    connectionId: v.id("connections"),
    stream: v.string(),
    cursor: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    status: v.union(v.literal("ok"), v.literal("delayed"), v.literal("failed")),
    error: v.optional(v.string()),
  }).index("by_connection_stream", ["connectionId", "stream"]),

  /* ---------------- Audit, privacy, operations ---------------- */
  auditEvents: defineTable({
    orgId: v.optional(v.id("organizations")),
    actorType: v.union(v.literal("user"), v.literal("system"), v.literal("operator"), v.literal("agent")),
    actorId: v.optional(v.string()),
    action: v.string(),
    subjectType: v.optional(v.string()),
    subjectId: v.optional(v.string()),
    summary: v.string(),
    createdAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_actor_created", ["actorType", "createdAt"]),

  privacyRequests: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("export"), v.literal("delete_contact"), v.literal("delete_workspace")),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("failed")),
    subject: v.optional(v.string()),
    requestedBy: v.id("users"),
    resultStorageId: v.optional(v.id("_storage")),
    note: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["status"]),

  fleetControls: defineTable({
    key: v.literal("global"),
    emergencyStop: v.boolean(),
    stopReason: v.optional(v.string()),
    circuits: v.array(
      v.object({
        provider: v.string(),
        state: v.union(v.literal("closed"), v.literal("open"), v.literal("half_open")),
        failures: v.number(),
        openedAt: v.optional(v.number()),
      }),
    ),
    previewDailyBudgetMicros: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  emailLog: defineTable({
    orgId: v.optional(v.id("organizations")),
    template: v.string(),
    toHash: v.string(),
    resendId: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("failed"),
      v.literal("suppressed"),
    ),
    createdAt: v.number(),
  })
    .index("by_resend", ["resendId"])
    .index("by_created", ["createdAt"]),

  platformSuppressions: defineTable({
    emailHash: v.string(),
    reason: v.union(v.literal("bounce"), v.literal("complaint"), v.literal("unsubscribe")),
    createdAt: v.number(),
  }).index("by_email", ["emailHash"]),

  /* ---------------- Landing-page live preview ---------------- */
  previews: defineTable({
    token: v.string(),
    ipHash: v.string(),
    website: v.string(),
    goal: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("reading"),
      v.literal("understanding"),
      v.literal("planning"),
      v.literal("done"),
      v.literal("failed"),
    ),
    steps: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("failed")),
      }),
    ),
    business: v.optional(
      v.object({ name: v.string(), summary: v.string(), audience: v.string(), category: v.string() }),
    ),
    facts: v.array(v.object({ statement: v.string(), sourceUrl: v.optional(v.string()), confidence: v.string() })),
    ideas: v.array(
      v.object({ title: v.string(), channel: v.string(), why: v.string(), firstStep: v.string(), role: v.string() }),
    ),
    error: v.optional(v.string()),
    costMicros: v.number(),
    claimedByOrgId: v.optional(v.id("organizations")),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_ip_created", ["ipHash", "createdAt"])
    .index("by_created", ["createdAt"]),
});
