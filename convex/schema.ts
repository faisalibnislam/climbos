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
        /** Engine v2 expert research: alternatives, customer language, objections, gaps. */
        expert: v.optional(
          v.object({
            alternatives: v.array(v.object({ name: v.string(), kind: v.string(), evidence: v.string(), sourceUrl: v.optional(v.string()) })),
            vocPhrases: v.array(v.object({ phrase: v.string(), theme: v.string(), sourceUrl: v.optional(v.string()) })),
            objections: v.array(v.object({ objection: v.string(), force: v.string(), counter: v.string(), sourceUrl: v.optional(v.string()) })),
            gaps: v.array(v.object({ gap: v.string(), evidence: v.string(), risk: v.string(), sourceUrl: v.optional(v.string()) })),
            positioningStatement: v.string(),
            confidenceNotes: v.string(),
          }),
        ),
        generatedAt: v.number(),
        runId: v.optional(v.id("workflowRuns")),
      }),
    ),
    /** Business classification for channel scoring; owner-confirmed values are kept across plan refreshes. */
    acquisition: v.optional(v.object({ types: v.array(v.string()), dims: v.any(), updatedAt: v.number() })),
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
    .index("by_provider_status", ["provider", "status"])
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

  /* ---------------- Outbound: find customers, write the emails, book the calls ---------------- */
  outboundCampaigns: defineTable({
    orgId: v.id("organizations"),
    title: v.string(),
    /** Owner's optional steer: who, where, how many. */
    brief: v.object({ who: v.string(), where: v.string(), count: v.number() }),
    status: v.union(v.literal("researching"), v.literal("review"), v.literal("failed"), v.literal("archived")),
    icp: v.optional(
      v.object({ summary: v.string(), mustHaves: v.array(v.string()), disqualifiers: v.array(v.string()), triggers: v.array(v.string()), decisionMaker: v.string() }),
    ),
    sequence: v.array(v.object({ day: v.number(), subject: v.string(), body: v.string(), purpose: v.string() })),
    ownerNotes: v.array(v.string()),
    excluded: v.array(v.object({ company: v.string(), reason: v.string() })),
    runId: v.optional(v.id("workflowRuns")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org_created", ["orgId", "createdAt"]),

  prospects: defineTable({
    orgId: v.id("organizations"),
    campaignId: v.id("outboundCampaigns"),
    company: v.string(),
    domain: v.string(),
    website: v.string(),
    location: v.string(),
    sizeBand: v.string(),
    why: v.string(),
    evidence: v.array(v.object({ url: v.string(), observation: v.string() })),
    trigger: v.string(),
    fit: v.number(),
    timing: v.number(),
    contact: v.string(),
    /** Only an address published verbatim on the prospect's own site. */
    publicEmail: v.optional(v.string()),
    firstLine: v.string(),
    stage: v.union(
      v.literal("suggested"),
      v.literal("approved"),
      v.literal("skipped"),
      v.literal("contacted"),
      v.literal("replied"),
      v.literal("booked"),
      v.literal("won"),
      v.literal("lost"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_org_stage", ["orgId", "stage"])
    .index("by_org_domain", ["orgId", "domain"]),

  bookingPages: defineTable({
    orgId: v.id("organizations"),
    slug: v.string(),
    title: v.string(),
    durationMin: v.number(),
    timezone: v.string(),
    /** 1 = Monday … 7 = Sunday. */
    days: v.array(v.number()),
    startHour: v.number(),
    endHour: v.number(),
    bufferMin: v.number(),
    noticeHours: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_org", ["orgId"]),

  bookings: defineTable({
    orgId: v.id("organizations"),
    pageId: v.id("bookingPages"),
    prospectId: v.optional(v.id("prospects")),
    name: v.string(),
    emailHash: v.string(),
    emailCiphertext: v.string(),
    emailIv: v.string(),
    emailKeyId: v.string(),
    company: v.optional(v.string()),
    note: v.optional(v.string()),
    startAt: v.number(),
    endAt: v.number(),
    status: v.union(v.literal("confirmed"), v.literal("cancelled")),
    createdAt: v.number(),
  })
    .index("by_page_start", ["pageId", "startAt"])
    .index("by_org_start", ["orgId", "startAt"]),

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
    /** Engine v2 expert plan detail. */
    expert: v.optional(
      v.object({
        diagnosis: v.string(),
        affordableCac: v.string(),
        notDoing: v.array(v.object({ channel: v.string(), why: v.string() })),
        northStar: v.object({ metric: v.string(), baseline: v.string(), target: v.string() }),
        leadingIndicators: v.array(v.object({ metric: v.string(), weeklyTarget: v.string(), source: v.string() })),
        phases: v.array(v.object({ name: v.string(), days: v.string(), focus: v.string() })),
        weekOneChecklist: v.array(v.string()),
        risks: v.array(v.object({ risk: v.string(), mitigation: v.string() })),
        /** Growth play cards (shared/agents/specs PlaySchema), validated by the agent schema. */
        plays: v.optional(v.array(v.any())),
      }),
    ),
    /** Acquisition Intelligence: the profile used and the agent's evidence-backed adjustments (scores are recomputed on read). */
    acquisition: v.optional(v.object({ libraryVersion: v.string(), profile: v.any(), adjustments: v.any(), summary: v.array(v.string()) })),
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
    artifactId: v.optional(v.id("artifacts")),
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
    .index("by_org_scheduled", ["orgId", "scheduledFor"])
    .index("by_run", ["runId"]),

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
    /** Set instead of imageStorageId when Cloudflare R2 is configured. */
    imageR2Key: v.optional(v.string()),
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

  /* ---------------- Climb AI (side-panel agent) ---------------- */
  climbMessages: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("step"), v.literal("action")),
    text: v.string(),
    /** Screen and pointed-at elements the owner sent with a message. */
    screen: v.optional(v.object({ path: v.string(), title: v.string() })),
    selection: v.optional(v.array(v.object({ type: v.string(), id: v.string(), label: v.string() }))),
    /** A consequential action waiting for the owner's tap (role "action"). */
    action: v.optional(
      v.object({
        tool: v.string(),
        input: v.string(),
        title: v.string(),
        summary: v.string(),
        status: v.union(v.literal("pending"), v.literal("done"), v.literal("canceled"), v.literal("failed")),
        result: v.optional(v.string()),
      }),
    ),
    /** Screen commands for the client to run (open a page, point at an element). */
    ui: v.optional(v.array(v.object({ kind: v.union(v.literal("go_to"), v.literal("highlight")), value: v.string(), note: v.optional(v.string()) }))),
    /** Links to things the agent made (drafts, jobs). */
    links: v.optional(v.array(v.object({ label: v.string(), href: v.string() }))),
    status: v.union(v.literal("done"), v.literal("working"), v.literal("failed")),
    runId: v.optional(v.id("workflowRuns")),
    createdAt: v.number(),
  }).index("by_org_user_created", ["orgId", "userId", "createdAt"]),

  /** Personal agent tokens for the ClimbOS MCP server (only the hash is stored). */
  agentTokens: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    tokenHash: v.string(),
    /** First characters, to recognise the token in the list. */
    prefix: v.string(),
    scopes: v.array(v.union(v.literal("read"), v.literal("draft"), v.literal("request_approval"))),
    lastUsedAt: v.optional(v.number()),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_org", ["orgId"]),

  /* ---------------- Real visuals: the asset library ---------------- */
  /** Real images for posts: site screenshots, store product photos, uploads, AI images and edits. */
  assets: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("screenshot"), v.literal("product_photo"), v.literal("upload"), v.literal("logo"), v.literal("ai_image"), v.literal("edited")),
    source: v.union(v.literal("website"), v.literal("store"), v.literal("upload"), v.literal("ai"), v.literal("edit")),
    view: v.optional(v.union(v.literal("desktop"), v.literal("mobile"), v.literal("section"), v.literal("product"), v.literal("other"))),
    storageId: v.optional(v.id("_storage")),
    r2Key: v.optional(v.string()),
    mime: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    label: v.string(),
    sourceUrl: v.optional(v.string()),
    product: v.optional(v.object({ name: v.string(), price: v.optional(v.string()), url: v.optional(v.string()) })),
    /** Edited from another asset (device frame, sample data, scene). */
    parentAssetId: v.optional(v.id("assets")),
    /** Shows made-up sample data (screens repopulated for privacy or clarity). */
    illustrative: v.optional(v.boolean()),
    createdBy: v.optional(v.id("users")),
    archived: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_kind", ["orgId", "kind"]),

  assetJobs: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("capture"), v.literal("products"), v.literal("edit")),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    target: v.optional(v.string()),
    count: v.number(),
    message: v.optional(v.string()),
    createdAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_org_created", ["orgId", "createdAt"]),

  /* ---------------- One-tap email actions ---------------- */
  /** Single-use links in emails (stop an automatic post, approve a draft). Only the hash is stored. */
  actionTokens: defineTable({
    tokenHash: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    kind: v.union(v.literal("stop_post"), v.literal("approve_post")),
    subjectId: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_subject", ["subjectId"]),

  /* ---------------- Social autopilot ---------------- */
  autopilotSettings: defineTable({
    orgId: v.id("organizations"),
    enabled: v.boolean(),
    mode: v.union(v.literal("always_ask"), v.literal("trust_ladder"), v.literal("auto")),
    channels: v.array(v.object({ channel: v.string(), postsPerWeek: v.number() })),
    /** Owner's preferred local posting hours; empty = channel defaults. */
    postingHours: v.array(v.number()),
    alwaysAskTopics: v.array(v.string()),
    /** Images for the first posts of each week (0-2), metered like manual jobs. */
    imagesPerWeek: v.number(),
    trust: v.array(v.object({ channel: v.string(), streak: v.number(), unlocked: v.boolean(), updatedAt: v.number() })),
    lastPlannedWeek: v.optional(v.string()),
    lastPlanRunId: v.optional(v.id("workflowRuns")),
    pausedReason: v.optional(v.string()),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_enabled", ["enabled"]),

  calendarSlots: defineTable({
    orgId: v.id("organizations"),
    /** Local Monday of the week, "YYYY-MM-DD". */
    weekOf: v.string(),
    planRunId: v.optional(v.id("workflowRuns")),
    channel: v.string(),
    day: v.number(),
    slotAt: v.number(),
    pillar: v.string(),
    purpose: v.string(),
    format: v.string(),
    idea: v.string(),
    angle: v.string(),
    hookDraft: v.string(),
    callToAction: v.string(),
    needsOwner: v.boolean(),
    ownerNote: v.optional(v.string()),
    status: v.union(
      v.literal("planned"),
      v.literal("drafting"),
      v.literal("needs_approval"),
      v.literal("scheduled"),
      v.literal("ready_to_post"),
      v.literal("published"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    artifactId: v.optional(v.id("artifacts")),
    draftRunId: v.optional(v.id("workflowRuns")),
    routing: v.optional(v.object({ decision: v.union(v.literal("auto"), v.literal("ask")), reasons: v.array(v.string()) })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_week", ["orgId", "weekOf"])
    .index("by_org_slot", ["orgId", "slotAt"])
    .index("by_artifact", ["artifactId"])
    .index("by_draft_run", ["draftRunId"]),

  weekPlans: defineTable({
    orgId: v.id("organizations"),
    weekOf: v.string(),
    runId: v.id("workflowRuns"),
    weekTheme: v.string(),
    pillars: v.array(v.object({ name: v.string(), why: v.string() })),
    learningsApplied: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_org_week", ["orgId", "weekOf"]),

  communityMessages: defineTable({
    orgId: v.id("organizations"),
    channel: v.string(),
    kind: v.union(v.literal("comment"), v.literal("dm"), v.literal("mention"), v.literal("review")),
    externalId: v.string(),
    artifactId: v.optional(v.id("artifacts")),
    authorName: v.string(),
    text: v.string(),
    receivedAt: v.number(),
    triage: v.optional(
      v.object({
        intent: v.union(v.literal("question"), v.literal("praise"), v.literal("complaint"), v.literal("lead"), v.literal("spam"), v.literal("other")),
        urgency: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
        needsOwner: v.boolean(),
        reason: v.string(),
      }),
    ),
    suggestedReply: v.optional(v.string()),
    finalReply: v.optional(v.string()),
    status: v.union(v.literal("new"), v.literal("suggested"), v.literal("replied"), v.literal("dismissed"), v.literal("escalated")),
    isFixture: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_external", ["orgId", "externalId"]),

  postMetrics: defineTable({
    orgId: v.id("organizations"),
    artifactId: v.id("artifacts"),
    channel: v.string(),
    capturedAt: v.number(),
    source: v.union(v.literal("platform"), v.literal("owner"), v.literal("fixture")),
    impressions: v.optional(v.number()),
    reach: v.optional(v.number()),
    likes: v.optional(v.number()),
    comments: v.optional(v.number()),
    shares: v.optional(v.number()),
    saves: v.optional(v.number()),
    clicks: v.optional(v.number()),
  })
    .index("by_org_captured", ["orgId", "capturedAt"])
    .index("by_artifact", ["artifactId"]),

  /* ---------------- Chat and action cards ---------------- */
  chatMessages: defineTable({
    orgId: v.id("organizations"),
    author: v.union(v.literal("user"), v.literal("climbos")),
    userId: v.optional(v.id("users")),
    text: v.string(),
    /** For replies to a wish: one sentence restating what the owner asked for. */
    understood: v.optional(v.string()),
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
      v.literal("set_up_autopilot"),
      v.literal("find_customers"),
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
    /** "v2" = agent loop with skills (Engine v2); absent = single-call v1. Fixed at creation. */
    engine: v.optional(v.literal("v2")),
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
    resultR2Key: v.optional(v.string()),
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
        alertedAt: v.optional(v.number()),
        reason: v.optional(v.string()),
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
