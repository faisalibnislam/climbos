import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const growthProvenanceValidator = v.union(v.literal("owner"), v.literal("research"), v.literal("benchmark"), v.literal("planned"), v.literal("assumption"));
const growthTagCheckValidator = v.union(v.literal("owner_input"), v.literal("source_verified"), v.literal("retrieved"), v.literal("reported"));
const growthSourceTagValidator = v.object({
  source: growthProvenanceValidator,
  ref: v.string(),
  quote: v.optional(v.string()),
  population: v.optional(v.string()),
  denominator: v.optional(v.string()),
  period: v.optional(v.string()),
  check: v.optional(growthTagCheckValidator),
  checkedBy: v.optional(v.string()),
  confirmedAt: v.optional(v.number()),
  access: v.optional(v.union(v.literal("read"), v.literal("search_only"), v.literal("unavailable"), v.literal("not_in_search"))),
  receipt: v.optional(v.object({ fetchedAt: v.number(), contentHash: v.string() })),
  replaced: v.optional(v.object({ value: v.number(), source: v.string() })),
});
const growthStepValidator = v.object({
  name: v.string(),
  rate: v.number(),
  low: v.number(),
  high: v.number(),
  source: growthProvenanceValidator,
  ref: v.string(),
  quote: v.optional(v.string()),
  population: v.optional(v.string()),
  denominator: v.optional(v.string()),
  period: v.optional(v.string()),
  baselineRate: v.optional(v.number()),
  check: v.optional(growthTagCheckValidator),
  checkedBy: v.optional(v.string()),
  access: v.optional(v.union(v.literal("read"), v.literal("search_only"), v.literal("unavailable"), v.literal("not_in_search"))),
  receipt: v.optional(v.object({ fetchedAt: v.number(), contentHash: v.string() })),
});
const growthPlayValidator = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  oneLiner: v.string(),
  kind: v.union(v.literal("bankable"), v.literal("creative"), v.literal("moonshot")),
  audience: v.string(),
  trigger: v.string(),
  hook: v.string(),
  mechanic: v.string(),
  assetUsed: v.string(),
  route: v.string(),
  funnel: v.array(v.string()),
  unit: v.string(),
  p10: v.number(),
  p50: v.number(),
  p90: v.number(),
  outcomeAccounting: v.optional(v.union(v.null(), v.object({
    attributionBasis: v.literal("modeled_play_funnel"),
    attributedCustomers: v.object({ p10: v.number(), p50: v.number(), p90: v.number() }),
    attributedRevenue12m: v.union(v.object({ p10: v.number(), p50: v.number(), p90: v.number() }), v.null()),
    incrementalityBasis: v.union(v.literal("modeled_baseline_delta"), v.literal("not_estimated")),
    modeledIncrementalCustomers: v.union(v.object({ p10: v.number(), p50: v.number(), p90: v.number() }), v.null()),
    modeledIncrementalRevenue12m: v.union(v.object({ p10: v.number(), p50: v.number(), p90: v.number() }), v.null()),
    currency: v.string(),
    revenueHorizonMonths: v.literal(12),
  }))),
  forecastUncertainty: v.optional(v.union(v.null(), v.object({
    rangeMethod: v.union(v.literal("input_scenario"), v.literal("single_scenario")),
    variedDrivers: v.array(v.string()),
    statisticalInterval: v.literal("not_estimated"),
    calibratedToBusiness: v.literal(false),
    timing: v.object({ reachRamp: v.union(v.literal("modeled"), v.literal("immediate_assumed")), paidConversionLag: v.union(v.literal("modeled"), v.literal("none_assumed")) }),
    omittedFactors: v.array(v.union(v.literal("seasonality"), v.literal("execution_variation"), v.literal("model_error"))),
  }))),
  financialEvidence: v.optional(v.union(v.null(), v.object({ status: v.union(v.literal("checked_inputs"), v.literal("conditional_scenario"), v.literal("unlabelled_scenario")), assumed: v.array(v.string()), unchecked: v.array(v.string()), planned: v.array(v.string()) }))),
  horizonDays: v.number(),
  confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
  biggestUnknown: v.string(),
  test: v.string(),
  killIf: v.string(),
  scaleIf: v.string(),
  scores: v.array(v.number()),
  firstActionToday: v.string(),
  actionContract: v.object({
    diagnosis: v.string(), intendedEffect: v.string(), evidenceBasis: v.union(v.literal("assumption"), v.literal("inference"), v.literal("measured"), v.literal("owner_report"), v.literal("source_claim")), evidenceNote: v.string(), evidenceRefs: v.array(v.string()), targetOrAsset: v.string(), resourcePlan: v.string(), executionCapability: v.union(v.literal("owner"), v.literal("climbos"), v.literal("existing_integration"), v.literal("external_setup"), v.literal("unknown")), dependencies: v.array(v.string()),
    measurement: v.object({ metric: v.string(), baseline: v.string(), target: v.string(), windowDays: v.number(), source: v.string() }),
  }),
  actionReadiness: v.optional(v.object({ status: v.union(v.literal("safe_to_start"), v.literal("depends_on_input")), reasons: v.array(v.string()) })),
  climbosCanDo: v.string(),
  model: v.object({
    weeklyReach: v.number(), weeklyReachLow: v.number(), weeklyReachHigh: v.number(), rampWeeks: v.optional(v.number()), salesLagDays: v.optional(v.number()), reachSource: growthSourceTagValidator, steps: v.array(growthStepValidator), monthlySpendUsd: v.number(), spendSource: growthSourceTagValidator, ownerHoursPerWeek: v.number(), otherMonthlyUsd: v.optional(v.number()), otherSource: v.optional(growthSourceTagValidator), hoursSource: growthSourceTagValidator,
  }),
  sensitivity: v.optional(v.array(v.object({ driver: v.string(), metric: v.union(v.literal("customers"), v.literal("net_contribution_12m")), atLow: v.number(), atMode: v.number(), atHigh: v.number() }))),
  cacRange: v.optional(v.union(v.null(), v.object({ p10: v.union(v.number(), v.null()), p50: v.union(v.number(), v.null()), p90: v.union(v.number(), v.null()) }))),
});
const growthPlanV9Validator = v.object({
  plays: v.array(growthPlayValidator),
  economics: v.object({
    revenuePerCustomerMonthUsd: v.number(), grossMargin: v.number(), monthlyChurn: v.number(), basis: v.string(), currency: v.optional(v.string()), assumed: v.optional(v.array(v.string())), ownerHourUsd: v.optional(v.number()),
    ranges: v.optional(v.object({ revenue: v.optional(v.object({ low: v.number(), high: v.number() })), margin: v.optional(v.object({ low: v.number(), high: v.number() })), churn: v.optional(v.object({ low: v.number(), high: v.number() })) })),
    sources: v.object({ revenue: growthSourceTagValidator, margin: growthSourceTagValidator, churn: growthSourceTagValidator, ownerHour: v.optional(growthSourceTagValidator) }),
  }),
});

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
  /** The owner's own mailbox (SMTP + IMAP, app password) for sending outbound emails. */
  v.literal("email_mailbox"),
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
  /** Shareable invite links (role, expiry, max uses). Seats still apply per account. */
  inviteLinks: defineTable({
    orgId: v.id("organizations"),
    role: v.union(v.literal("admin"), v.literal("editor"), v.literal("reviewer"), v.literal("viewer")),
    tokenHash: v.string(),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    maxUses: v.number(),
    uses: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_token", ["tokenHash"]),

  /** Team comments on drafts, plans, cards and jobs, with @mentions. */
  comments: defineTable({
    orgId: v.id("organizations"),
    subjectType: v.union(v.literal("artifact"), v.literal("card"), v.literal("run"), v.literal("strategy"), v.literal("campaign")),
    subjectId: v.string(),
    authorId: v.id("users"),
    body: v.string(),
    mentions: v.array(v.id("users")),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_subject", ["orgId", "subjectType", "subjectId", "createdAt"])
    .index("by_org_created", ["orgId", "createdAt"]),

  /** Who owns a piece of work. */
  assignments: defineTable({
    orgId: v.id("organizations"),
    subjectType: v.union(v.literal("artifact"), v.literal("card"), v.literal("run"), v.literal("strategy"), v.literal("campaign")),
    subjectId: v.string(),
    title: v.string(),
    href: v.string(),
    assigneeId: v.id("users"),
    assignedBy: v.id("users"),
    doneAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_subject", ["orgId", "subjectType", "subjectId"])
    .index("by_assignee", ["assigneeId", "createdAt"]),

  /** Who's looking at what right now (heartbeat every 30s; stale after 75s). */
  presence: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    path: v.string(),
    lastSeen: v.number(),
  })
    .index("by_org_path", ["orgId", "path"])
    .index("by_user_org", ["userId", "orgId"]),

  /** In-app notices for a person (mentions, assignments, approvals). */
  notices: defineTable({
    userId: v.id("users"),
    orgId: v.id("organizations"),
    kind: v.union(v.literal("mention"), v.literal("assigned"), v.literal("approval"), v.literal("comment"), v.literal("system")),
    text: v.string(),
    href: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_created", ["createdAt"]),

  /** ClimbOS staff (beyond the OPS_EMAILS owners): admins and support members. */
  staff: defineTable({
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("support")),
    addedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  /** Read-only "view as user" sessions for staff (logged and shown in the workspace's activity). */
  staffViews: defineTable({
    staffUserId: v.id("users"),
    orgId: v.id("organizations"),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_staff_org", ["staffUserId", "orgId"]),

  /** Staff-triggered checks of approved library sources; fetches never publish guidance. */
  growthKnowledgeSources: defineTable({
    registryId: v.string(),
    url: v.string(),
    title: v.string(),
    status: v.union(v.literal("queued"), v.literal("checking"), v.literal("baseline_set"), v.literal("unchanged"), v.literal("update_pending"), v.literal("blocked_by_robots"), v.literal("failed")),
    accessReview: v.literal("not_reviewed"),
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    checkedAt: v.optional(v.number()),
    nextCheckAt: v.optional(v.number()),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    contentText: v.optional(v.string()),
    lastError: v.optional(v.string()),
    version: v.number(),
  })
    .index("by_registry_id", ["registryId"])
    .index("by_status_requested", ["status", "requestedAt"]),

  /** Candidate source changes staged for human review; never consumed by production retrieval. */
  growthKnowledgeProposals: defineTable({
    sourceId: v.id("growthKnowledgeSources"),
    registryId: v.string(),
    url: v.string(),
    title: v.string(),
    version: v.number(),
    previousHash: v.string(),
    currentHash: v.string(),
    removedPassages: v.array(v.string()),
    addedPassages: v.array(v.string()),
    claimScopes: v.array(v.string()),
    applicability: v.literal("unreviewed"),
    affectedRules: v.literal("unassessed"),
    rationale: v.literal("Source content changed; human review required."),
    evaluationImpact: v.literal("not_run; production guidance unchanged"),
    status: v.union(v.literal("pending_review"), v.literal("dismissed")),
    createdAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_status_created", ["status", "createdAt"])
    .index("by_source_version", ["sourceId", "version"]),

  /** Live settings staff change without a deploy (plans, credits, feature locks). */
  appConfig: defineTable({
    key: v.string(),
    value: v.string(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  /**
   * Billing account: one owner, one package and one credit balance shared by
   * all of its workspaces (agencies get one bill). Seats are per account.
   */
  accounts: defineTable({
    ownerUserId: v.id("users"),
    name: v.string(),
    /** The one-time free credits were granted (once per account). */
    freeCreditsGrantedAt: v.optional(v.number()),
    /** Share link code (climbos.app/r/CODE). */
    referralCode: v.optional(v.string()),
    /** White-label client reports: the agency's name, colour and logo. */
    brandName: v.optional(v.string()),
    brandColor: v.optional(v.string()),
    brandLogoUrl: v.optional(v.string()),
    suspendedAt: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_referral_code", ["referralCode"]),

  /** Referrals: both accounts get credits when the referred account buys its first package. */
  referrals: defineTable({
    referrerAccountId: v.id("accounts"),
    referredAccountId: v.id("accounts"),
    status: v.union(v.literal("signed_up"), v.literal("rewarded")),
    credits: v.optional(v.number()),
    rewardedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_referrer", ["referrerAccountId", "createdAt"])
    .index("by_referred", ["referredAccountId"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    kind: v.union(v.literal("customer"), v.literal("demo")),
    /** Engine rollout flags for this workspace (REQ-ENG-01), set by ClimbOS staff only, e.g. "decision_contract". */
    engineFlags: v.optional(v.array(v.string())),
    createdBy: v.id("users"),
    timezone: v.string(),
    /** Default Climb AI mode for new jobs (Expert needs a paid plan). Absent = expert when paid, else basic. */
    aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))),
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
    /** Billing account (shared credits). Absent only on demo workspaces. */
    accountId: v.optional(v.id("accounts")),
    /** Optional monthly credit cap for this workspace, drawn from the account's shared balance. */
    monthlyCreditCap: v.optional(v.number()),
    /** Set by ClimbOS staff: no new work until lifted. */
    suspendedAt: v.optional(v.number()),
    /** Tracked links in drafts (default on). */
    linkTracking: v.optional(v.boolean()),
    /** Language for customer-facing content (default English). */
    contentLanguage: v.optional(v.string()),
    /** "First win": drafts started automatically after the first plan (3 posts + 1 email). */
    firstWinRunIds: v.optional(v.array(v.id("workflowRuns"))),
    /** Team rules: jobs above this many credits need an owner or admin to start them. */
    creditApprovalLimit: v.optional(v.number()),
    /** Periodic competitor research cadence in days; 0 disables scheduled refreshes. Default is 90. */
    competitorResearchRefreshDays: v.optional(v.union(v.literal(0), v.literal(30), v.literal(60), v.literal(90), v.literal(180))),
    /** Bounded cursor for one-time initialization of refresh times on legacy businesses. */
    competitorResearchBackfillCursor: v.optional(v.string()),
    competitorResearchBackfillDone: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_kind_created", ["kind", "createdAt"])
    .index("by_account", ["accountId"]),

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
    .index("by_invite_token", ["inviteTokenHash"])
    .index("by_status_expires", ["status", "inviteExpiresAt"]),

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
    /** Owner-selected lifecycle stage; this is not inferred from website copy or treated as performance evidence. */
    lifecycleStage: v.optional(v.object({
      stage: v.union(
        v.literal("idea_validation"),
        v.literal("pre_launch"),
        v.literal("early_traction"),
        v.literal("growth"),
        v.literal("maturity"),
        v.literal("decline"),
      ),
      provenance: v.literal("owner_reported"),
      updatedAt: v.number(),
    })),
    summary: v.optional(v.string()),
    /** Where happy customers leave a review (e.g. the Google review link). */
    reviewUrl: v.optional(v.string()),
    /** Self-improvement loop 1: last weekly read of the business's own site (normalised text, for the diff). */
    /** Unit economics the owner confirmed; they replace the planner's assumptions. */
    unitEconomics: v.optional(
      v.object({
        revenuePerCustomerMonthUsd: v.optional(v.number()),
        grossMargin: v.optional(v.number()),
        monthlyChurn: v.optional(v.number()),
        ownerHourUsd: v.optional(v.number()),
        ownerHoursPerWeek: v.optional(v.number()),
        /** Additional new customers (clients, bookings, projects) the owner can accept each month with current operations. */
        newCustomersPerMonth: v.optional(v.number()),
        /** Owner-stated ranges (their judgement, low–high); the value above is the midpoint (shared/agents/voi.ts). */
        ranges: v.optional(v.object({ revenue: v.optional(v.object({ low: v.number(), high: v.number() })), margin: v.optional(v.object({ low: v.number(), high: v.number() })), churn: v.optional(v.object({ low: v.number(), high: v.number() })) })),
        updatedAt: v.number(),
      }),
    ),
    /** The owner's last-period funnel (counts over periodDays); code reads the weakest link from it (shared/agents/diagnosis.ts). */
    funnel: v.optional(
      v.object({
        periodDays: v.number(),
        visitors: v.optional(v.number()),
        leads: v.optional(v.number()),
        qualifiedLeads: v.optional(v.number()),
        qualificationDefinition: v.optional(v.string()),
        activated: v.optional(v.number()),
        newCustomers: v.optional(v.number()),
        /** What was counted as activated: value received, a habit, setup only, or unclear. */
        activationKind: v.optional(v.union(v.literal("value"), v.literal("habit"), v.literal("setup"), v.literal("unknown"))),
        /** Software only: what a signup is; picks the conversion reference (shared/agents/references.ts). Absent means unknown. */
        signupKind: v.optional(v.union(v.literal("free_plan"), v.literal("trial_no_card"), v.literal("trial_card"), v.literal("unknown"))),
        updatedAt: v.number(),
      }),
    ),
    siteHash: v.optional(v.string()),
    siteText: v.optional(v.string()),
    siteCheckedAt: v.optional(v.number()),
    siteReadiness: v.optional(v.object({
      status: v.union(v.literal("queued"), v.literal("complete"), v.literal("failed")),
      startedAt: v.number(),
      checkedAt: v.optional(v.number()),
      pageUrl: v.optional(v.string()),
      pageTitle: v.optional(v.string()),
      description: v.optional(v.string()),
      headingCount: v.optional(v.number()),
      structuredDataTypes: v.optional(v.array(v.string())),
      findings: v.optional(v.array(v.object({ id: v.string(), level: v.union(v.literal("check"), v.literal("attention")), title: v.string(), evidence: v.string(), nextStep: v.string() }))),
      error: v.optional(v.string()),
    })),
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
        audiences: v.array(v.object({
          name: v.string(), description: v.string(), confidence: v.string(),
          needs: v.optional(v.array(v.object({ statement: v.string(), basis: v.union(v.literal("owner_report"), v.literal("measured"), v.literal("research"), v.literal("inference")), evidenceRefs: v.array(v.string()) }))),
          objections: v.optional(v.array(v.object({ statement: v.string(), basis: v.union(v.literal("owner_report"), v.literal("measured"), v.literal("research"), v.literal("inference")), evidenceRefs: v.array(v.string()) }))),
          purchasingMotivations: v.optional(v.array(v.object({ statement: v.string(), basis: v.union(v.literal("owner_report"), v.literal("measured"), v.literal("research"), v.literal("inference")), evidenceRefs: v.array(v.string()) }))),
          channelPreferences: v.optional(v.array(v.object({ channel: v.string(), rationale: v.string(), basis: v.union(v.literal("owner_report"), v.literal("measured"), v.literal("research"), v.literal("inference")), evidenceRefs: v.array(v.string()) }))),
        })),
        competitors: v.array(
          v.object({
            name: v.string(),
            url: v.optional(v.string()),
            note: v.string(),
            sourceUrl: v.optional(v.string()),
            kind: v.optional(v.union(v.literal("direct"), v.literal("adjacent"))),
            comparison: v.optional(v.array(v.object({
              dimension: v.union(v.literal("target_customer"), v.literal("positioning"), v.literal("offer"), v.literal("pricing"), v.literal("proof"), v.literal("distribution"), v.literal("experience"), v.literal("other")),
              finding: v.string(),
              sourceUrl: v.string(),
              implication: v.string(),
            }))),
          }),
        ),
        positioning: v.string(),
        pricingNotes: v.string(),
        swot: v.object({
          strengths: v.array(v.string()),
          weaknesses: v.array(v.string()),
          opportunities: v.array(v.string()),
          threats: v.array(v.string()),
        }),
        swotEvidence: v.optional(v.array(v.object({
          dimension: v.union(v.literal("strength"), v.literal("weakness"), v.literal("opportunity"), v.literal("threat")),
          finding: v.string(),
          basis: v.union(v.literal("owner_report"), v.literal("source_claim"), v.literal("measured"), v.literal("research"), v.literal("inference")),
          evidenceRefs: v.array(v.string()),
          strategicImplication: v.string(),
          confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
        }))),
        swotMoves: v.optional(v.array(v.object({
          kind: v.union(v.literal("strength_opportunity"), v.literal("weakness_opportunity"), v.literal("strength_threat"), v.literal("weakness_threat")),
          firstIndex: v.number(),
          secondIndex: v.number(),
          move: v.string(),
          firstTest: v.string(),
          measure: v.string(),
        }))),
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
            siteAssessment: v.optional(v.array(v.object({
              dimension: v.union(
                v.literal("offer_clarity"),
                v.literal("buyer_specificity"),
                v.literal("proof_presentation"),
                v.literal("conversion_path"),
                v.literal("trust_signals"),
                v.literal("messaging_consistency"),
              ),
              observation: v.string(),
              evidenceQuote: v.string(),
              sourceUrl: v.optional(v.string()),
              implication: v.string(),
            }))),
          }),
        ),
        generatedAt: v.number(),
        runId: v.optional(v.id("workflowRuns")),
      }),
    ),
    /** Business classification for channel scoring; owner-confirmed values are kept across plan refreshes. */
    acquisition: v.optional(v.object({ types: v.array(v.string()), typesSource: v.optional(v.union(v.literal("owner"), v.literal("inferred"))), dims: v.any(), channelPreferences: v.optional(v.array(v.object({ channelId: v.string(), preference: v.union(v.literal("prefer"), v.literal("avoid")), rationale: v.string() }))), updatedAt: v.number() })),
    /** Next bounded research refresh; owner profile/fact changes move this to now. */
    competitorResearchNextAt: v.optional(v.number()),
    competitorResearchStaleAt: v.optional(v.number()),
    competitorResearchCompletedAt: v.optional(v.number()),
    competitorResearchLastStatus: v.optional(v.union(v.literal("scheduled"), v.literal("waiting_for_credits"), v.literal("waiting_for_owner"), v.literal("no_website"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_competitor_research_due", ["competitorResearchNextAt"]),

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
    /** A fact the weekly site check proposes to replace (rejected when this one is confirmed). */
    replacesFactId: v.optional(v.id("businessFacts")),
    sourceIds: v.array(v.id("factSources")),
    updatedBy: v.optional(v.id("users")),
    /** Last time an owner confirmed or edited this statement; older rows fall back to updatedAt. */
    verifiedAt: v.optional(v.number()),
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
    /** Structured target (spec §8.1): kept as the owner stated it, never rewritten to match a forecast. */
    target: v.optional(v.object({ metric: v.union(v.literal("customers"), v.literal("revenue_month"), v.literal("other")), baseline: v.union(v.number(), v.null()), desired: v.union(v.number(), v.null()), mode: v.union(v.literal("total"), v.literal("incremental")) })),
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
    /** Short style examples the owner controls and is authorized to share; these do not prove customer outcomes. */
    approvedExamples: v.optional(v.array(v.string())),
    logoStorageId: v.optional(v.id("_storage")),
    /** Voice learning: short rules learned from how the owner edits drafts. */
    learnedRules: v.optional(v.array(v.object({ text: v.string(), at: v.number() }))),
    /** Explicit owner/admin opt-in; absent legacy values remain disabled. */
    voiceLearningEnabled: v.optional(v.boolean()),
    updatedAt: v.number(),
  }).index("by_business", ["businessId"]),

  /** Before/after pairs from the owner's edits to AI drafts (input to voice learning). */
  voiceSamples: defineTable({
    orgId: v.id("organizations"),
    channel: v.string(),
    before: v.string(),
    after: v.string(),
    used: v.boolean(),
    createdAt: v.number(),
  }).index("by_org_used", ["orgId", "used"]),

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
    /** The expiry we already warned the owner about (one notice per token). */
    expiryNoticeFor: v.optional(v.number()),
    isFixture: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_provider", ["orgId", "provider"])
    .index("by_provider_status", ["provider", "status"])
    .index("by_expires", ["expiresAt"])
    .index("by_provider_status_expires", ["provider", "status", "expiresAt"]),

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
    /** Who to find: customers (companies) or creators (influencers to partner with). Absent = customers. */
    kind: v.optional(v.union(v.literal("customers"), v.literal("creators"))),
    /** plan_targets (S6, REQ-TARGET-01/04): the plan and the play (stable ID) this search finds targets for. */
    strategyId: v.optional(v.id("strategies")),
    playId: v.optional(v.string()),
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
    /** Sending from the owner's mailbox (started by the owner; stops on reply, bounce or opt-out). */
    sending: v.optional(
      v.object({
        status: v.union(v.literal("on"), v.literal("paused"), v.literal("done")),
        startedAt: v.number(),
        startedBy: v.id("users"),
        firstSentAt: v.optional(v.number()),
        dailyCapOverride: v.optional(v.number()),
        senderName: v.string(),
        company: v.string(),
        address: v.string(),
        bookingUrl: v.optional(v.string()),
        lastReplyCheckAt: v.optional(v.number()),
        /** Fingerprint of the emails and sender details the owner approved (spec §23); any change pauses sending. */
        contentHash: v.optional(v.string()),
        pausedReason: v.optional(v.union(v.literal("content_changed"), v.literal("archived"))),
        /** Last email sent (the 21-day reply watch runs from here). */
        lastSentAt: v.optional(v.number()),
      }),
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_sending", ["sending.status"]),

  /** One email to one prospect for one sequence step. */
  outboundSends: defineTable({
    orgId: v.id("organizations"),
    campaignId: v.id("outboundCampaigns"),
    prospectId: v.id("prospects"),
    /** Subject experiment whose assigned variant was used to compose this first-step email. */
    abTestId: v.optional(v.id("abTests")),
    step: v.number(),
    to: v.string(),
    scheduledFor: v.number(),
    /** uncertain = it may have gone out; never resent until the Sent folder or the owner says. */
    status: v.union(v.literal("queued"), v.literal("sending"), v.literal("sent"), v.literal("failed"), v.literal("canceled"), v.literal("bounced"), v.literal("uncertain")),
    messageId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
    attempts: v.number(),
    /** Stable key: org, prospect, step and approved content (sendOpKey). Also the Message-ID. */
    opKey: v.optional(v.string()),
    /** The exact email first tried under opKey; a different one is refused. */
    payloadHash: v.optional(v.string()),
    /** The worker allowed to send now, until leaseExpiresAt. */
    lease: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    /** When that worker started handing it to the mailbox. */
    claimedAt: v.optional(v.number()),
    reviewReason: v.optional(v.union(v.literal("lease_expired"), v.literal("no_response"), v.literal("payload_changed"), v.literal("unverifiable"))),
    createdAt: v.number(),
  })
    .index("by_status_scheduled", ["status", "scheduledFor"])
    .index("by_status_lease", ["status", "leaseExpiresAt"])
    .index("by_op_key", ["opKey"])
    .index("by_campaign", ["campaignId", "createdAt"])
    .index("by_prospect", ["prospectId", "step"])
    .index("by_org_sent", ["orgId", "sentAt"]),

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
    /** Our checks: the site is live, where the email was published, and the domain receives mail. */
    check: v.optional(v.object({ siteLive: v.boolean(), emailSource: v.optional(v.string()), emailKind: v.optional(v.string()), mxOk: v.optional(v.boolean()), checkedAt: v.number() })),
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
    /** When the pipeline stage last changed; separate from unrelated edits to the prospect record. */
    stageUpdatedAt: v.optional(v.number()),
    /** Owner-reported reply quality; absent means unknown, never inferred from a generic reply. */
    replyDisposition: v.optional(v.union(v.literal("qualified"), v.literal("not_qualified"), v.literal("unclear"))),
    replyDispositionUpdatedAt: v.optional(v.number()),
    /** plan_targets (S6): plays (stable IDs) this target was found for; one record per entity across plans (REQ-TARGET-06). */
    playIds: v.optional(v.array(v.string())),
    /** Creators: canonical identity from the profile path (REQ-TARGET-03), e.g. instagram + "studio.ana". */
    platform: v.optional(v.string()),
    handle: v.optional(v.string()),
    /** Creator audience figure copied as displayed, with its exact evidence URL; never a model estimate. */
    audienceSize: v.optional(v.object({ value: v.string(), sourceUrl: v.string() })),
    /** Creator language copied from public profile/content evidence; absent means unknown. */
    contentLanguage: v.optional(v.object({ value: v.string(), sourceUrl: v.string() })),
    /** Exact visible counts from a bounded set of public content examples; descriptive, not a performance forecast. */
    contentSamples: v.optional(v.array(v.object({
      url: v.string(),
      format: v.union(v.literal("short_video"), v.literal("long_video"), v.literal("image"), v.literal("text"), v.literal("live"), v.literal("other")),
      views: v.optional(v.string()),
      likes: v.optional(v.string()),
      comments: v.optional(v.string()),
    }))),
    /** Suggested collaboration concept; this does not imply creator agreement. */
    collaborationConcept: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_org_stage", ["orgId", "stage"])
    .index("by_org_domain", ["orgId", "domain"])
    .index("by_org_email", ["orgId", "publicEmail"]),

  /** Append-only, owner-reported lifecycle and outcome notes for creator collaborations. */
  creatorCollaborationReports: defineTable({
    orgId: v.id("organizations"),
    prospectId: v.id("prospects"),
    campaignId: v.id("outboundCampaigns"),
    strategyId: v.optional(v.id("strategies")),
    playId: v.optional(v.string()),
    status: v.union(
      v.literal("discussion_started"),
      v.literal("interested"),
      v.literal("negotiating"),
      v.literal("agreed"),
      v.literal("content_published"),
      v.literal("completed"),
      v.literal("declined"),
      v.literal("cancelled"),
    ),
    format: v.optional(v.union(v.literal("paid"), v.literal("gifted"), v.literal("affiliate"), v.literal("co_created"), v.literal("event"), v.literal("other"))),
    agreedValueMinor: v.optional(v.number()),
    actualCostMinor: v.optional(v.number()),
    currency: v.optional(v.string()),
    publishedUrl: v.optional(v.string()),
    metric: v.optional(v.object({
      name: v.string(),
      kind: v.union(v.literal("count"), v.literal("rate"), v.literal("amount")),
      value: v.number(),
      unit: v.string(),
      denominator: v.optional(v.number()),
      eligible: v.optional(v.number()),
      exposed: v.optional(v.number()),
      currency: v.optional(v.string()),
      periodStartAt: v.number(),
      periodEndAt: v.number(),
      sourceUrl: v.optional(v.string()),
    })),
    note: v.optional(v.string()),
    /** These entries are explicitly owner-reported, even if a source link is attached. */
    basis: v.literal("owner_reported"),
    reportedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_prospect_created", ["prospectId", "createdAt"]),

  /** Engine lab (self-improvement loop 3): playbook rules proposed from reviews, A/B tested, approved in /ops. */
  engineProposals: defineTable({
    agentId: v.string(),
    rules: v.string(),
    rationale: v.string(),
    status: v.union(v.literal("proposed"), v.literal("testing"), v.literal("approved"), v.literal("rejected"), v.literal("retired")),
    test: v.optional(v.object({
      baseline: v.optional(v.number()), variant: v.optional(v.number()), costMicros: v.number(), at: v.number(), error: v.optional(v.string()),
      /** Snapshots of the engine and frozen case set actually compared. Legacy records may not have them. */
      engineVersion: v.optional(v.string()), caseSetVersion: v.optional(v.string()),
      /** A staff-recorded blind human evaluation; self-review scores alone cannot promote a rule. */
      humanReview: v.optional(v.object({
        reviewerId: v.string(), packetId: v.string(), fullSetSha256: v.string(), holdoutSetSha256: v.string(),
        reviewedCases: v.number(), incompleteCases: v.number(), heldoutReviewedCases: v.number(),
        baselinePreferred: v.number(), candidatePreferred: v.number(), ties: v.number(),
        baselineHardFailures: v.number(), candidateHardFailures: v.number(), heldoutCandidateHardFailures: v.number(),
        baselineMeanScore: v.number(), candidateMeanScore: v.number(),
        coverage: v.array(v.object({ businessType: v.string(), reviewedCases: v.number() })),
        recordedBy: v.id("users"), recordedAt: v.number(),
      })),
    })),
    decidedBy: v.optional(v.id("users")),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_agent_status", ["agentId", "status"]),

  /** What a growth play actually did, logged weekly by the owner (spec §28). */
  playResults: defineTable({
    orgId: v.id("organizations"),
    strategyId: v.id("strategies"),
    playName: v.string(),
    /** Stable play ID (REQ-LEARN-04); results follow it when the play is renamed. Older rows match by name. */
    playId: v.optional(v.string()),
    weekStart: v.number(),
    reach: v.number(),
    /** People passing each funnel step of the play's model, in order. */
    steps: v.array(v.number()),
    spendUsd: v.number(),
    ownerHours: v.number(),
    /** Optional weekly, owner-reported repeat-customer outcomes; money uses the business currency's minor unit. */
    repeatCustomers: v.optional(v.number()),
    retainedRevenueMinor: v.optional(v.number()),
    retainedContributionMinor: v.optional(v.number()),
    retentionCurrency: v.optional(v.string()),
    enteredBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_strategy", ["strategyId", "playName", "weekStart"])
    .index("by_org", ["orgId", "updatedAt"]),

  /**
   * Owner feedback on a plan's parts with a specific reason (cycle 2). Each
   * reason feeds a different record: a wrong fact goes back to review, "done"
   * keeps the result, the rest reach the next plan as constraints.
   */
  ownerFeedback: defineTable({
    orgId: v.id("organizations"),
    strategyId: v.id("strategies"),
    subjectKind: v.union(v.literal("play"), v.literal("channel"), v.literal("fact"), v.literal("plan")),
    /** Play id or name, channel key, fact id, or "plan". */
    subjectKey: v.string(),
    subjectLabel: v.string(),
    reason: v.union(v.literal("wrong_fact"), v.literal("too_expensive"), v.literal("cannot_implement"), v.literal("already_tried"), v.literal("done"), v.literal("not_relevant")),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId", "createdAt"])
    .index("by_strategy", ["strategyId", "createdAt"]),

  /** Engine quality per agent run (spec §27): context sizes, lint by rule draft → final, numbers lost in revision. No tenant text. */
  engineQuality: defineTable({
    runId: v.id("workflowRuns"),
    agentId: v.string(),
    mode: v.string(),
    data: v.string(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  /** Learning from results: first-party rates, per workspace and k-anonymous business-type or owner-reported-stage cohorts. */
  learnedRates: defineTable({
    /** Workspace-only, business-type, lifecycle-stage, or exact owner-confirmed offer/audience/geography scope; pooled rows require k ≥ 10. */
    scope: v.string(),
    metric: v.string(),
    workspaces: v.number(),
    trials: v.number(),
    successes: v.number(),
    rate: v.number(),
    updatedAt: v.number(),
  }).index("by_scope_metric", ["scope", "metric"]),

  /** Public status: a health sample every 5 minutes per component. */
  statusSamples: defineTable({
    at: v.number(),
    day: v.string(),
    components: v.array(v.object({ key: v.string(), status: v.union(v.literal("ok"), v.literal("degraded"), v.literal("down")), note: v.optional(v.string()) })),
  })
    .index("by_at", ["at"])
    .index("by_day", ["day"]),

  /** Client report links (white-label for agencies). */
  reportShares: defineTable({
    orgId: v.id("organizations"),
    token: v.string(),
    revokedAt: v.optional(v.number()),
    views: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_org", ["orgId"]),

  /** Web push: a user's devices, and messages waiting for the service worker to pull. */
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    endpointHash: v.string(),
    label: v.optional(v.string()),
    failures: v.number(),
    lastOkAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["endpointHash"]),

  pushOutbox: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    url: v.string(),
    tag: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
    /** Devices that already pulled this message (each device gets it once). */
    deliveredTo: v.optional(v.array(v.id("pushSubscriptions"))),
    createdAt: v.number(),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_created", ["createdAt"]),

  /** A/B tests ClimbOS runs end to end: landing page headlines and outreach subject lines. */
  abTests: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("landing"), v.literal("email_subject")),
    /** The landing page or outbound campaign id. */
    targetId: v.string(),
    /** A is the current version; B the challenger (JSON for landing pages, text for subjects). */
    variants: v.array(v.object({ key: v.string(), value: v.string() })),
    stats: v.array(v.object({ key: v.string(), assigned: v.optional(v.number()), exposed: v.optional(v.number()), trials: v.number(), wins: v.number() })),
    status: v.union(v.literal("running"), v.literal("maturing"), v.literal("done"), v.literal("invalid"), v.literal("stopped")),
    winner: v.optional(v.string()),
    note: v.optional(v.string()),
    /** Outcome collection window after the planned exposure sample is reached. */
    outcomeWindowMs: v.optional(v.number()),
    maturesAt: v.optional(v.number()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_target", ["targetId", "status"])
    .index("by_org", ["orgId", "startedAt"]),

  /** Anonymous, per-test assignment/exposure/outcome events; subject identifiers are stored only as hashes. */
  abTestAssignments: defineTable({
    orgId: v.id("organizations"),
    testId: v.id("abTests"),
    subjectHash: v.string(),
    variant: v.union(v.literal("A"), v.literal("B")),
    assignedAt: v.number(),
    exposedAt: v.optional(v.number()),
    outcomeAt: v.optional(v.number()),
  })
    .index("by_test_subject", ["testId", "subjectHash"])
    .index("by_test", ["testId", "assignedAt"]),

  /** Airly apps (Formkit, Meetrao, Taskeni, Folevi): the owner's token for each, encrypted, plus sync state. */
  airlyLinks: defineTable({
    orgId: v.id("organizations"),
    app: v.union(v.literal("formkit"), v.literal("meetrao"), v.literal("taskeni"), v.literal("folevi"), v.literal("involets")),
    tokenCiphertext: v.string(),
    tokenIv: v.string(),
    tokenKeyId: v.string(),
    label: v.optional(v.string()),
    status: v.union(v.literal("connected"), v.literal("error")),
    error: v.optional(v.string()),
    /** App-specific choices, e.g. the Taskeni board for new tasks or the Folevi place for notes (JSON). */
    settings: v.optional(v.string()),
    /** Incremental sync position (e.g. last response or booking time seen). */
    cursor: v.optional(v.string()),
    lastSyncAt: v.optional(v.number()),
    imported: v.number(),
    /** Consecutive transient sync failures and when to try again (backoff). */
    failures: v.optional(v.number()),
    retryAt: v.optional(v.number()),
    /** Incoming webhook: token in our URL and the app's signing secret (encrypted), when set up. */
    inboundToken: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_inbound", ["inboundToken"]),

  /** Outgoing webhooks (Zapier, Make or your own server): signed events, retried with backoff. */
  webhookEndpoints: defineTable({
    orgId: v.id("organizations"),
    url: v.string(),
    events: v.array(v.string()),
    secretCiphertext: v.string(),
    secretIv: v.string(),
    secretKeyId: v.string(),
    active: v.boolean(),
    failures: v.number(),
    lastStatus: v.optional(v.number()),
    lastAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  webhookDeliveries: defineTable({
    orgId: v.id("organizations"),
    endpointId: v.id("webhookEndpoints"),
    event: v.string(),
    payload: v.string(),
    /** "sending": claimed by one deliverer until nextAt (a lease), so rows are never POSTed twice. */
    status: v.union(v.literal("pending"), v.literal("sending"), v.literal("delivered"), v.literal("failed")),
    attempts: v.number(),
    nextAt: v.number(),
    responseCode: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status_next", ["status", "nextAt"])
    .index("by_endpoint", ["endpointId", "createdAt"]),

  /** Link in bio: one page per workspace at /bio/SLUG; each link is a tracked link. */
  bioPages: defineTable({
    orgId: v.id("organizations"),
    slug: v.string(),
    title: v.string(),
    bio: v.string(),
    color: v.string(),
    links: v.array(v.object({ label: v.string(), url: v.string(), linkId: v.optional(v.id("links")) })),
    collectEmails: v.boolean(),
    live: v.boolean(),
    views: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_org", ["orgId"]),

  /** Landing pages: written by Climb AI from the business facts, hosted at /p/SLUG. */
  landingPages: defineTable({
    orgId: v.id("organizations"),
    slug: v.string(),
    title: v.string(),
    brief: v.string(),
    status: v.union(v.literal("drafting"), v.literal("draft"), v.literal("live"), v.literal("failed")),
    /** JSON of LandingContent (shared/landing). */
    content: v.optional(v.string()),
    color: v.string(),
    runId: v.optional(v.id("workflowRuns")),
    views: v.number(),
    leads: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_org", ["orgId", "createdAt"]),

  /** Website chat widget (one per workspace) and its conversations. */
  chatWidgets: defineTable({
    orgId: v.id("organizations"),
    key: v.string(),
    enabled: v.boolean(),
    greeting: v.string(),
    color: v.string(),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_org", ["orgId"]),

  chatThreads: defineTable({
    orgId: v.id("organizations"),
    widgetId: v.id("chatWidgets"),
    visitorId: v.string(),
    email: v.optional(v.string()),
    page: v.optional(v.string()),
    /** The owner replied: Climb AI stops answering this conversation. */
    humanTookOver: v.boolean(),
    aiAnswers: v.number(),
    inboxMessageId: v.optional(v.id("communityMessages")),
    dealId: v.optional(v.id("deals")),
    /** Salted hash of the visitor's IP (rate limits only). */
    ipHash: v.optional(v.string()),
    lastAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_widget_visitor", ["widgetId", "visitorId"])
    .index("by_org_last", ["orgId", "lastAt"])
    .index("by_ip_created", ["ipHash", "createdAt"]),

  widgetMessages: defineTable({
    orgId: v.id("organizations"),
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("visitor"), v.literal("ai"), v.literal("owner")),
    text: v.string(),
    ipHash: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_thread", ["threadId", "at"])
    .index("by_ip_at", ["ipHash", "at"]),

  /** Competitor watch: pages we check weekly, and what changed. */
  competitorWatches: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    url: v.string(),
    active: v.boolean(),
    /** The owner removed this watch; keep its host as a tombstone so discovery does not re-add it. */
    excludedAt: v.optional(v.number()),
    /** Discovery provenance for auto-seeded watches; legacy/manual watches omit these fields. */
    autoSeededAt: v.optional(v.number()),
    discoverySourceUrl: v.optional(v.string()),
    lastCheckedAt: v.optional(v.number()),
    lastHash: v.optional(v.string()),
    /** Normalised text of the last check (homepage + pricing), for the next diff. */
    lastText: v.optional(v.string()),
    /** Pages included in lastText, retained so future change summaries can cite their origin. */
    lastSourceUrls: v.optional(v.array(v.string())),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_active", ["active"]),

  competitorChanges: defineTable({
    orgId: v.id("organizations"),
    watchId: v.id("competitorWatches"),
    name: v.string(),
    summary: v.string(),
    bullets: v.array(v.string()),
    soWhat: v.optional(v.string()),
    /** Pages fetched for the comparison; the model summary is an interpretation of these sources. */
    sourceUrls: v.optional(v.array(v.string())),
    /** Exact changed text retained as source evidence for the model's summary. */
    evidence: v.optional(v.object({ removed: v.array(v.string()), added: v.array(v.string()) })),
    at: v.number(),
  }).index("by_org_at", ["orgId", "at"]),

  /** Review requests sent to the owner's customers (from their own mailbox). */
  reviewRequests: defineTable({
    orgId: v.id("organizations"),
    dealId: v.optional(v.id("deals")),
    name: v.string(),
    email: v.string(),
    token: v.string(),
    status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    clickedAt: v.optional(v.number()),
    feedbackAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_email", ["orgId", "email", "createdAt"]),

  /** Tracked links: our own short links (climbos.app/l/CODE) with UTM tags. */
  links: defineTable({
    orgId: v.id("organizations"),
    code: v.string(),
    url: v.string(),
    label: v.string(),
    channel: v.optional(v.string()),
    campaign: v.optional(v.string()),
    artifactId: v.optional(v.id("artifacts")),
    source: v.union(v.literal("auto"), v.literal("manual")),
    clicks: v.number(),
    lastClickAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_artifact", ["artifactId"]),

  linkClickDays: defineTable({
    orgId: v.id("organizations"),
    linkId: v.id("links"),
    day: v.string(),
    clicks: v.number(),
  })
    .index("by_link_day", ["linkId", "day"])
    .index("by_org_day", ["orgId", "day"]),

  /** Who already clicked a link today (salted IP hash), so repeat clicks count once. */
  linkClickIps: defineTable({
    linkId: v.id("links"),
    day: v.string(),
    ipHash: v.string(),
  })
    .index("by_link_day_ip", ["linkId", "day", "ipHash"])
    .index("by_day", ["day"]),

  /** Mini-CRM: one row per person or company the owner is working with. */
  deals: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    stage: v.union(v.literal("lead"), v.literal("talking"), v.literal("booked"), v.literal("won"), v.literal("lost")),
    source: v.union(v.literal("outbound"), v.literal("booking"), v.literal("inbox"), v.literal("manual")),
    prospectId: v.optional(v.id("prospects")),
    valueMinor: v.optional(v.number()),
    currency: v.string(),
    notes: v.array(v.object({ text: v.string(), at: v.number(), userId: v.optional(v.id("users")) })),
    nextStep: v.optional(v.string()),
    nextStepAt: v.optional(v.number()),
    wonAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_updated", ["orgId", "updatedAt"])
    .index("by_org_stage", ["orgId", "stage"])
    .index("by_prospect", ["prospectId"]),

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
    /** Guest's private link to cancel or rebook (sha256 of the token). */
    manageTokenHash: v.optional(v.string()),
    reminderSentAt: v.optional(v.number()),
    outcome: v.optional(v.union(v.literal("attended"), v.literal("no_show"))),
    followUpSentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_page_start", ["pageId", "startAt"])
    .index("by_org_start", ["orgId", "startAt"])
    .index("by_manage", ["manageTokenHash"])
    .index("by_status_start", ["status", "startAt"]),

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
    /** `sources`: what each audience rests on (confirmed facts or pages the research read), resolved at save. */
    audiences: v.array(v.object({ name: v.string(), hypothesis: v.string(), evidence: v.string(), sources: v.optional(v.array(v.union(v.object({ kind: v.literal("fact"), factId: v.string() }), v.object({ kind: v.literal("web"), url: v.string(), title: v.optional(v.string()) })))) })),
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
        /** What this channel rests on (confirmed facts or pages the research read), resolved at save. */
        sources: v.optional(v.array(v.union(v.object({ kind: v.literal("fact"), factId: v.string() }), v.object({ kind: v.literal("web"), url: v.string(), title: v.optional(v.string()) })))),
        /** The action card that runs this channel's work once the plan is approved. */
        cardId: v.optional(v.id("actionCards")),
      }),
    ),
    constraints: v.array(v.string()),
    measurementPlan: v.string(),
    /** Engine v2 expert plan detail. */
    expert: v.optional(
      v.object({
        /** Persisted expert-plan shape; 0 is reserved for rows created before versioning. */
        version: v.optional(v.number()),
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
        /** What one customer is worth (from the plays agent); the UI computes each play's cost per customer from it. */
        economics: v.optional(v.any()),
        /** Previous v8 JSON envelope; accepted for historical compatibility. */
        growthPlanV8: v.optional(v.string()),
        /** Nested Convex-validated current growth plan; replaces the JSON envelope for new writes. */
        growthPlanV9: v.optional(growthPlanV9Validator),
        /** Plan quality, separate from the run finishing (passed / provisional / needs_input / failed). */
        quality: v.optional(
          v.object({
            version: v.number(),
            state: v.union(v.literal("passed"), v.literal("provisional"), v.literal("needs_input"), v.literal("failed")),
            reasons: v.array(v.string()),
            hard: v.array(v.string()),
            /** Hard findings with where they sit, so the owner knows what to fix. */
            fixes: v.optional(v.array(v.object({ rule: v.string(), path: v.optional(v.string()), message: v.string() }))),
            /** Inputs the plan worked without (hours, email audience). */
            unknowns: v.optional(v.array(v.string())),
            /** Confirmed facts that disagree, for the owner to settle. */
            conflicts: v.optional(v.array(v.string())),
            agents: v.any(),
          }),
        ),
        /** What this plan was built from (spec §04), for tracing results back to inputs. */
        snapshot: v.optional(
          v.object({
            snapshotVersion: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5), v.literal(6), v.literal(7), v.literal(8), v.literal(9), v.literal(10), v.literal(11), v.literal(12), v.literal(13), v.literal(14), v.literal(15), v.literal(16), v.literal(17), v.literal(18)),
            snapshotId: v.string(),
            capturedAt: v.number(),
            engine: v.string(),
            aiMode: v.string(),
            goal: v.string(),
            horizonDays: v.number(),
            monthlyAdBudget: v.number(),
            currency: v.optional(v.string()),
            facts: v.number(),
            factVersions: v.array(v.object({ id: v.string(), updatedAt: v.number() })),
            businessProfile: v.optional(v.any()),
            businessFactVersions: v.optional(v.array(v.object({ id: v.string(), updatedAt: v.number() }))),
            brandProfile: v.optional(v.any()),
            ownerAcquisitionTypes: v.optional(v.union(v.array(v.string()), v.null())),
            ownerAcquisitionDimensions: v.optional(v.any()),
            ownerChannelPreferences: v.optional(v.array(v.object({ channelId: v.string(), preference: v.union(v.literal("prefer"), v.literal("avoid")), rationale: v.string() }))),
            businessResearchAt: v.optional(v.union(v.number(), v.null())),
            marketChangeVersions: v.optional(v.array(v.object({ id: v.string(), at: v.number() }))),
            staleFactIds: v.array(v.string()),
            contradictions: v.array(v.object({ subject: v.string(), values: v.array(v.string()), factIds: v.array(v.string()) })),
            insightsChars: v.number(),
            insightsHash: v.string(),
            sourceUrls: v.array(v.string()),
            capabilities: v.array(v.string()),
            businessLifecycleStage: v.optional(v.union(v.object({ stage: v.string(), provenance: v.literal("owner_reported"), updatedAt: v.number() }), v.null())),
            businessFunnel: v.optional(v.union(v.object({ periodDays: v.number(), visitors: v.optional(v.number()), leads: v.optional(v.number()), qualifiedLeads: v.optional(v.number()), qualificationDefinition: v.optional(v.string()), activated: v.optional(v.number()), newCustomers: v.optional(v.number()), activationKind: v.optional(v.union(v.literal("value"), v.literal("habit"), v.literal("setup"), v.literal("unknown"))), signupKind: v.optional(v.union(v.literal("free_plan"), v.literal("trial_no_card"), v.literal("trial_card"), v.literal("unknown"))), updatedAt: v.number() }), v.null())),
            goalInput: v.optional(v.union(v.object({ id: v.string(), kind: v.union(v.literal("more_sales"), v.literal("more_customers"), v.literal("more_reach"), v.literal("custom")), statement: v.string(), horizonDays: v.number(), monthlyAdBudgetMinor: v.number(), currency: v.string(), target: v.union(v.object({ metric: v.union(v.literal("customers"), v.literal("revenue_month"), v.literal("other")), baseline: v.union(v.number(), v.null()), desired: v.union(v.number(), v.null()), mode: v.union(v.literal("total"), v.literal("incremental")) }), v.null()) }), v.null())),
            knowledgeReferences: v.optional(v.object({
              edition: v.string(),
              researchCutoff: v.string(),
              records: v.array(v.object({ id: v.string(), kind: v.string(), bookId: v.string(), heading: v.string(), path: v.string(), sha256: v.string(), sources: v.optional(v.array(v.object({ registryId: v.string(), url: v.string(), title: v.string(), retrievedAt: v.string(), publicationDate: v.union(v.string(), v.null()), claims: v.array(v.object({ sourceId: v.string(), scope: v.string(), verificationStatus: v.string() })), freshness: v.optional(v.object({ status: v.union(v.literal("checked_recently"), v.literal("recheck_due"), v.literal("direct_check_required"), v.literal("not_scheduled"), v.literal("invalid_check_date")), checkedAt: v.union(v.string(), v.null()), nextCheckAt: v.union(v.string(), v.null()), cadenceDays: v.union(v.number(), v.null()), directPageRead: v.boolean() })) }))) })),
            })),
            ownerEconomics: v.optional(v.any()),
            refundExposure: v.optional(v.object({
              currency: v.string(),
              fromMs: v.number(),
              toMs: v.number(),
              paymentCount: v.number(),
              explicitRefundEventCount: v.number(),
              grossPaidMinor: v.number(),
              refundsRecordedMinor: v.number(),
              netPaidMinor: v.number(),
              refundToGrossShare: v.union(v.number(), v.null()),
              ratioUnavailableReason: v.optional(v.union(v.literal("no_gross_payments"), v.literal("refunds_exceed_window_gross"))),
              duplicatesRemoved: v.number(),
              partial: v.boolean(),
            })),
            channelOutcomes: v.optional(v.object({
              currency: v.string(),
              fromMs: v.number(),
              toMs: v.number(),
              eventCount: v.number(),
              attributedConversions: v.number(),
              totalConversions: v.number(),
              attributedPositiveNetMinor: v.number(),
              sources: v.array(v.object({
                source: v.string(),
                paymentEvents: v.number(),
                identifiedCustomers: v.number(),
                firstRecordedCustomers: v.number(),
                netRevenueMinor: v.number(),
                refundMinor: v.number(),
                mediaSpendStatus: v.optional(v.union(v.literal("matched"), v.literal("not_reported"), v.literal("currency_mismatch"), v.literal("partial"))),
                mediaSpendOrigin: v.optional(v.union(v.literal("owner_reported"), v.literal("platform_reported"), v.literal("mixed"), v.literal("unknown"))),
                adSpendMinor: v.optional(v.number()),
                mediaRoas: v.optional(v.union(v.number(), v.null())),
                modeledContributionAfterMediaSpendMinor: v.optional(v.number()),
              })),
              topSource: v.union(v.string(), v.null()),
              topSourceShare: v.union(v.number(), v.null()),
              topThreeShare: v.union(v.number(), v.null()),
              duplicatesRemoved: v.number(),
              partial: v.boolean(),
              spendPartial: v.boolean(),
            })),
            goalTarget: v.optional(v.any()),
            flags: v.optional(v.array(v.string())),
          }),
        ),
        /** Owner goal vs what the plays support (computed in code; spec §8.1). */
        goalGap: v.optional(v.any()),
        /** The weakest link computed from the owner's numbers (shared/agents/diagnosis.ts); `diagnosis` is the plan's prose. */
        constraintDiagnosis: v.optional(v.any()),
        /** Best feasible set of plays under the owner's joint limits, and the strongest alternative (economics.ts selectPortfolio). */
        portfolio: v.optional(v.any()),
        /** Playbooks that fit and those that didn't, with reasons (shared/playbooks/contracts.ts). */
        playbooks: v.optional(v.any()),
        /** decision_contract plans: the structured decision the plays rest on (shared/agents/decision.ts, REQ-STRAT-01/02). */
        decision: v.optional(
          v.object({
            observations: v.array(v.object({ observation: v.string(), source: v.string(), evidenceRefs: v.optional(v.array(v.string())) })),
            constraint: v.string(),
            explanations: v.array(v.object({ explanation: v.string(), evidenceFor: v.string(), evidenceAgainst: v.string() })),
            limits: v.string(),
            options: v.array(v.object({ name: v.string(), kind: v.string(), plays: v.array(v.string()), chosen: v.boolean(), whyNot: v.string() })),
            guidingPolicy: v.string(),
            /** New structured strategic focus; optional so existing saved decisions remain readable. */
            focus: v.optional(v.object({ primaryPlay: v.string(), supportingMove: v.string(), maintenanceWork: v.string() })),
            falsifier: v.string(),
          }),
        ),
        /** Deterministic decision-option calculation trace, bound to the immutable plan snapshot. */
        decisionAnalysis: v.optional(v.object({
          snapshotId: v.union(v.string(), v.null()),
          method: v.literal("seeded_joint_scenario_mean_v1"),
          horizonDays: v.number(),
          currency: v.string(),
          valuePerCustomer: v.union(v.number(), v.null()),
          scoreBasis: v.union(v.literal("expected_customers"), v.literal("net_contribution")),
          constraints: v.object({ monthlyAdBudgetUsd: v.union(v.number(), v.null()), ownerHoursPerWeek: v.union(v.number(), v.null()), newCustomersPerMonth: v.union(v.number(), v.null()) }),
          probabilityCalibrated: v.literal(false),
          limitations: v.array(v.string()),
          options: v.array(v.object({
            name: v.string(),
            chosen: v.boolean(),
            playNames: v.array(v.string()),
            calculated: v.boolean(),
            unavailableReason: v.union(v.string(), v.null()),
            feasible: v.union(v.boolean(), v.null()),
            customerRange: v.union(v.object({ p10: v.number(), p50: v.number(), p90: v.number() }), v.null()),
            expectedCustomers: v.union(v.number(), v.null()),
            cost: v.union(v.number(), v.null()),
            monthlySpend: v.union(v.number(), v.null()),
            ownerHoursPerWeek: v.union(v.number(), v.null()),
            netContribution: v.union(v.number(), v.null()),
          })),
        })),
        /** Web pages the research phases actually read (spec §07): what the plan's citations can point to. */
        webSources: v.optional(v.array(v.object({ url: v.string(), title: v.optional(v.string()) }))),
      }),
    ),
    /** Acquisition Intelligence: the profile used and the agent's evidence-backed adjustments (scores are recomputed on read). */
    acquisition: v.optional(
      v.object({
        libraryVersion: v.string(),
        profile: v.any(),
        adjustments: v.any(),
        summary: v.array(v.string()),
        /** Owner limits applied before ranking (REQ-STRAT-03); connected providers are read live. */
        limits: v.optional(v.object({
          ownerHoursPerWeek: v.union(v.number(), v.null()),
          newCustomersPerMonth: v.optional(v.union(v.number(), v.null())),
        })),
      }),
    ),
    reviewDate: v.string(),
    sourceFactIds: v.array(v.id("businessFacts")),
    generationCostMicros: v.number(),
    runId: v.optional(v.id("workflowRuns")),
    approvalId: v.optional(v.id("approvals")),
    /** Set when the owner restored this version (all or some parts) from an older one. */
    restoredFrom: v.optional(v.object({ version: v.number(), parts: v.array(v.string()) })),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  /**
   * What a plan version knew when it was written (Book 14 §4–5): the facts,
   * insights and research notes it was given, plus engine, skill and model
   * versions. Kept apart from the plan so the plan page stays small; immutable.
   * `data` is JSON (shared/agents/evidence.ts PlanEvidence), `hash` its SHA-256.
   */
  planEvidence: defineTable({
    orgId: v.id("organizations"),
    strategyId: v.id("strategies"),
    runId: v.id("workflowRuns"),
    data: v.string(),
    hash: v.string(),
    createdAt: v.number(),
  })
    .index("by_strategy", ["strategyId"])
    .index("by_org", ["orgId"]),

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
    /** Fields below are absent on legacy rows; new strategy runs populate the full preregistration contract. */
    assignmentUnit: v.optional(v.string()),
    assignmentMethod: v.optional(v.union(v.literal("randomized"), v.literal("deterministic_hash"), v.literal("platform_randomized"), v.literal("matched"), v.literal("owner_selected"), v.literal("time_based"), v.literal("not_applicable"))),
    primaryMetric: v.string(),
    primaryMetricType: v.optional(v.union(v.literal("binary_rate"), v.literal("count"), v.literal("continuous"), v.literal("monetary"))),
    denominator: v.optional(v.string()),
    baselineRate: v.optional(v.union(v.number(), v.null())),
    baselineProvenance: v.optional(v.union(v.literal("measured"), v.literal("owner_report"), v.literal("source_reported"), v.literal("unknown"))),
    baselineEvidenceRefs: v.optional(v.array(v.string())),
    baselineBasis: v.optional(v.string()),
    minimumMeaningfulEffect: v.optional(v.object({ value: v.union(v.number(), v.null()), unit: v.string(), basis: v.string() })),
    plannedSamplePerArm: v.optional(v.union(v.number(), v.null())),
    plannedSampleBasis: v.optional(v.string()),
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
    /**
     * Structured outcomes (Book 14 §14). The hypothesis, metric and stopping
     * rule above stay as written; an analysis on a changed definition is
     * appended, never written over. Last = current. `inference` is computed
     * (shared/growth/experimentOutcome.ts), never entered.
     */
    analyses: v.optional(
      v.array(
        v.object({
          n: v.number(),
          executed: v.boolean(),
          source: v.union(v.literal("owner_report"), v.literal("integration"), v.literal("platform_report")),
          design: v.union(v.literal("none"), v.literal("before_after"), v.literal("holdout"), v.literal("randomized")),
          eligible: v.optional(v.number()),
          exposed: v.optional(v.number()),
          conversions: v.optional(v.number()),
          controlSize: v.optional(v.number()),
          controlConversions: v.optional(v.number()),
          /** Planned % in the changed version, so the split can be checked. */
          plannedSharePct: v.optional(v.number()),
          /** Holdouts: how the comparison group was chosen (only random supports "incremental"). */
          assignment: v.optional(v.union(v.literal("random"), v.literal("rule"), v.literal("owner_choice"))),
          windowStart: v.optional(v.string()),
          windowEnd: v.optional(v.string()),
          metric: v.string(),
          successRule: v.string(),
          result: v.union(v.literal("met"), v.literal("missed"), v.literal("unclear")),
          stopRuleHit: v.boolean(),
          note: v.optional(v.string()),
          inference: v.union(v.literal("observed"), v.literal("attributed"), v.literal("incremental"), v.literal("not_run")),
          /** Judged on a metric or rule other than the experiment's original. */
          redefined: v.boolean(),
          reviewedBy: v.id("users"),
          reviewedAt: v.number(),
        }),
      ),
    ),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_strategy", ["strategyId"]),

  /** Sampled AI-search answers, entered from observations; separate from content-readiness heuristics and business outcomes. */
  aiSearchPanels: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    /** Query sets are immutable; create a new panel to change prompts or locations. */
    queries: v.array(v.object({
      key: v.string(),
      provider: v.union(v.literal("chatgpt"), v.literal("gemini"), v.literal("perplexity"), v.literal("google_ai_overview"), v.literal("other")),
      query: v.string(),
      location: v.optional(v.string()),
    })),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_org_created", ["orgId", "createdAt"]),

  aiSearchObservations: defineTable({
    orgId: v.id("organizations"),
    panelId: v.optional(v.id("aiSearchPanels")),
    panelQueryKey: v.optional(v.string()),
    provider: v.union(v.literal("chatgpt"), v.literal("gemini"), v.literal("perplexity"), v.literal("google_ai_overview"), v.literal("other")),
    query: v.string(),
    location: v.optional(v.string()),
    checkedAt: v.number(),
    answerStatus: v.union(v.literal("answered"), v.literal("no_answer"), v.literal("failed")),
    brandMention: v.union(v.literal("yes"), v.literal("no"), v.literal("unknown")),
    sentiment: v.union(v.literal("positive"), v.literal("neutral"), v.literal("negative"), v.literal("mixed"), v.literal("unknown")),
    citedUrls: v.array(v.string()),
    competitorMentions: v.array(v.string()),
    answerExcerpt: v.optional(v.string()),
    evidenceBasis: v.literal("owner_observed"),
    enteredBy: v.id("users"),
    enteredAt: v.number(),
  })
    .index("by_org_checked", ["orgId", "checkedAt"])
    .index("by_org_panel_checked", ["orgId", "panelId", "checkedAt"])
    .index("by_org_query_checked", ["orgId", "query", "checkedAt"]),

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
    /** Why the last publish attempt didn't go out (cleared on the next approval or success). */
    lastPublishError: v.optional(v.object({ message: v.string(), at: v.number() })),
    /** Reel posts: the video this post carries. */
    reelId: v.optional(v.id("reels")),
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
    /** Owner-facing copy strategy cue, separate from publishable content. */
    contentAngle: v.optional(v.string()),
    copyBrief: v.optional(v.object({
      reader: v.string(), situation: v.string(), awarenessStage: v.string(), relationshipStage: v.string(), objective: v.string(),
      offerFactIds: v.array(v.id("businessFacts")), problemJob: v.string(), trigger: v.string(), centralIdea: v.string(), objection: v.string(),
      proofFactIds: v.array(v.id("businessFacts")), prohibitedClaims: v.array(v.string()), channel: v.string(), format: v.string(), deliveryContext: v.string(),
      brandVoice: v.string(), approvedExamples: v.array(v.string()), cta: v.string(), afterAction: v.string(), trackingMetric: v.string(), trackingMethod: v.string(),
      supportingFactIds: v.array(v.id("businessFacts")), supportingSourceUrls: v.array(v.string()), unknowns: v.array(v.string()),
    })),
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
    /** For tool steps: what the step found, and when it finished. */
    detail: v.optional(v.string()),
    finishedAt: v.optional(v.number()),
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

  /** Owner-configured specialists routed through existing metered, approval-aware workflows. */
  customAgents: defineTable({
    orgId: v.id("organizations"),
    archetypeId: v.string(),
    name: v.string(),
    objective: v.string(),
    instructions: v.string(),
    allowedActions: v.array(v.string()),
    knowledge: v.array(v.string()),
    permission: v.union(v.literal("read_only"), v.literal("draft"), v.literal("request_approval")),
    /** Maximum projected spend across this run's action cards, expressed in ClimbOS credits. */
    maxRunCredits: v.number(),
    /** Optional for profiles created before monthly budgets were introduced. */
    monthlyBudgetCredits: v.optional(v.number()),
    maxActionsPerRun: v.number(),
    successMetric: v.string(),
    trigger: v.union(v.literal("manual"), v.literal("daily"), v.literal("weekly")),
    nextTriggerAt: v.optional(v.number()),
    modelRouting: v.literal("automatic"),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org_updated", ["orgId", "updatedAt"])
    .index("by_org_archetype", ["orgId", "archetypeId"])
    .index("by_status_trigger_next", ["status", "trigger", "nextTriggerAt"]),

  /** Human outcome notes on a specialist run; separates owner-reported results from platform measurements. */
  customAgentFeedback: defineTable({
    orgId: v.id("organizations"),
    customAgentId: v.id("customAgents"),
    workflowRunId: v.id("workflowRuns"),
    userId: v.id("users"),
    rating: v.union(v.literal("helpful"), v.literal("needs_work")),
    note: v.optional(v.string()),
    evidenceKind: v.literal("member_reported"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run_user", ["workflowRunId", "userId"])
    .index("by_agent_created", ["orgId", "customAgentId", "createdAt"])
    .index("by_agent_updated", ["orgId", "customAgentId", "updatedAt"]),

  /** Workspace-member usefulness reports for built-in agent runs; not measured business outcomes. */
  builtInAgentFeedback: defineTable({
    orgId: v.id("organizations"),
    agentArchetypeId: v.string(),
    workflowRunId: v.id("workflowRuns"),
    userId: v.id("users"),
    rating: v.union(v.literal("helpful"), v.literal("needs_work")),
    note: v.optional(v.string()),
    evidenceKind: v.literal("member_reported"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run_user", ["workflowRunId", "userId"])
    .index("by_archetype_updated", ["orgId", "agentArchetypeId", "updatedAt"]),

  /** Workspace-member reported measurements after a specialist run; these are observations, never causal proof. */
  builtInAgentOutcomeReports: defineTable({
    orgId: v.id("organizations"),
    agentArchetypeId: v.string(),
    workflowRunId: v.id("workflowRuns"),
    userId: v.id("users"),
    metricKey: v.string(),
    metric: v.string(),
    measureType: v.union(v.literal("count"), v.literal("rate"), v.literal("currency"), v.literal("duration")),
    unit: v.string(),
    value: v.number(),
    denominator: v.optional(v.number()),
    comparisonValue: v.optional(v.number()),
    comparisonDenominator: v.optional(v.number()),
    comparisonLabel: v.optional(v.string()),
    cohort: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
    evidenceKind: v.literal("member_reported"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run_user_metric", ["workflowRunId", "userId", "metricKey"])
    .index("by_archetype_updated", ["orgId", "agentArchetypeId", "updatedAt"])
    .index("by_archetype_period", ["orgId", "agentArchetypeId", "periodEnd"]),

  /* ---------------- Real visuals: the asset library ---------------- */
  /** Real images for posts: site screenshots, store product photos, uploads, AI images and edits. */
  assets: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("screenshot"), v.literal("product_photo"), v.literal("upload"), v.literal("logo"), v.literal("ai_image"), v.literal("edited"), v.literal("design")),
    source: v.union(v.literal("website"), v.literal("store"), v.literal("upload"), v.literal("ai"), v.literal("edit"), v.literal("design")),
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

  /** Designs made in ClimbOS's own design editor (image posts, carousels, documents). */
  designs: defineTable({
    orgId: v.id("organizations"),
    title: v.string(),
    format: v.string(),
    /** The DesignDoc as JSON (shared/design/types). Images are "asset:<id>" references, never inline data. */
    doc: v.string(),
    pages: v.number(),
    /** The post this design was made for or attached to, if any. */
    artifactId: v.optional(v.id("artifacts")),
    createdBy: v.id("users"),
    archived: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org_updated", ["orgId", "updatedAt"]),

  /** Short vertical videos (Reels, TikTok, Shorts) made by our own renderer. */
  reels: defineTable({
    orgId: v.id("organizations"),
    title: v.string(),
    brief: v.string(),
    status: v.union(v.literal("working"), v.literal("ready"), v.literal("failed")),
    runId: v.optional(v.id("workflowRuns")),
    scenes: v.array(v.object({ caption: v.string(), sub: v.optional(v.string()), assetId: v.optional(v.id("assets")), cta: v.optional(v.boolean()) })),
    caption: v.optional(v.string()),
    videoStorageId: v.optional(v.id("_storage")),
    seconds: v.optional(v.number()),
    badge: v.boolean(),
    /** AI video clips requested (paid; Veo). */
    clips: v.optional(v.number()),
    error: v.optional(v.string()),
    /** The post (content item) that carries this reel through approval and export. */
    artifactId: v.optional(v.id("artifacts")),
    /** Rendered without the video worker (demo/dev): no real video. */
    isDemo: v.optional(v.boolean()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org_created", ["orgId", "createdAt"]),

  assetJobs: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("capture"), v.literal("products"), v.literal("edit")),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    target: v.optional(v.string()),
    count: v.number(),
    message: v.optional(v.string()),
    /** Live stages for the progress panel. */
    stages: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("failed")),
          startedAt: v.optional(v.number()),
          finishedAt: v.optional(v.number()),
          detail: v.optional(v.string()),
        }),
      ),
    ),
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
    /** Climb AI mode for the weekly plan (Expert needs a paid plan). Absent = workspace default. */
    aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))),
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
    kind: v.union(v.literal("comment"), v.literal("dm"), v.literal("mention"), v.literal("review"), v.literal("email"), v.literal("booking"), v.literal("chat"), v.literal("form")),
    externalId: v.string(),
    /** Unified inbox: who wrote (email replies), the thread, and the run drafting our answer. */
    prospectId: v.optional(v.id("prospects")),
    campaignId: v.optional(v.id("outboundCampaigns")),
    fromEmail: v.optional(v.string()),
    subject: v.optional(v.string()),
    messageRef: v.optional(v.string()),
    draftRunId: v.optional(v.id("workflowRuns")),
    readAt: v.optional(v.number()),
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
    .index("by_org_status_received", ["orgId", "status", "receivedAt"])
    .index("by_org_external", ["orgId", "externalId"])
    .index("by_org_received", ["orgId", "receivedAt"])
    .index("by_draft_run", ["draftRunId"]),

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
    /** Specialist profile that initiated this conversation, if any. */
    customAgentId: v.optional(v.id("customAgents")),
    /** For replies to a wish: one sentence restating what the owner asked for. */
    understood: v.optional(v.string()),
    roles: v.array(agentRoleValidator),
    actionCardIds: v.array(v.id("actionCards")),
    status: v.union(v.literal("done"), v.literal("thinking"), v.literal("failed")),
    /** The job that is understanding this wish (for live progress). */
    runId: v.optional(v.id("workflowRuns")),
    /** For the team's answer: the wish it answers. */
    replyTo: v.optional(v.id("chatMessages")),
    createdAt: v.number(),
  }).index("by_org_created", ["orgId", "createdAt"]),

  actionCards: defineTable({
    orgId: v.id("organizations"),
    /** Earlier action cards that must finish before this action can start. */
    dependsOnActionCardIds: v.optional(v.array(v.id("actionCards"))),
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
    /** Profile and originating request let budgets and outcome reporting follow child work. */
    customAgentId: v.optional(v.id("customAgents")),
    customAgentParentRunId: v.optional(v.id("workflowRuns")),
    /** Built-in specialist selected by the coordinator for this action. */
    agentArchetypeId: v.optional(v.string()),
    /** Immutable role contract used by this run so retries keep their original evaluation criteria. */
    agentArchetypeSnapshot: v.optional(v.object({
      version: v.literal(1),
      id: v.string(),
      name: v.string(),
      objective: v.string(),
      role: agentRoleValidator,
      defaultActions: v.array(v.string()),
      successMeasures: v.object({ outputQuality: v.string(), businessOutcome: v.string(), guardrail: v.string() }),
    })),
    /** Immutable member-reported usefulness context for this built-in role, captured at run creation. */
    agentArchetypeFeedbackSnapshot: v.optional(v.object({
      source: v.literal("workspace_member_report"),
      windowDays: v.number(),
      capturedAt: v.number(),
      sampleSize: v.number(),
      helpful: v.number(),
      needsWork: v.number(),
      capped: v.boolean(),
      notes: v.array(v.object({ rating: v.union(v.literal("helpful"), v.literal("needs_work")), note: v.string(), updatedAt: v.number() })),
    })),
    /** Immutable, member-reported outcome observations from this workspace and specialist role. */
    agentArchetypeOutcomeSnapshot: v.optional(v.object({
      source: v.literal("workspace_member_report"),
      windowDays: v.number(),
      capturedAt: v.number(),
      reports: v.array(v.object({
        metric: v.string(),
        measureType: v.union(v.literal("count"), v.literal("rate"), v.literal("currency"), v.literal("duration")),
        unit: v.string(),
        value: v.number(),
        denominator: v.optional(v.number()),
        comparisonValue: v.optional(v.number()),
        comparisonDenominator: v.optional(v.number()),
        comparisonLabel: v.optional(v.string()),
        cohort: v.string(),
        periodStart: v.number(),
        periodEnd: v.number(),
        updatedAt: v.number(),
      })),
      capped: v.boolean(),
    })),
    /** Immutable profile context used by this run and any action runs it starts. */
    customAgentSnapshot: v.optional(v.object({
      archetypeId: v.string(),
      name: v.string(),
      objective: v.string(),
      instructions: v.string(),
      allowedActions: v.array(v.string()),
      knowledge: v.array(v.string()),
      permission: v.union(v.literal("read_only"), v.literal("draft"), v.literal("request_approval")),
      maxRunCredits: v.number(),
      monthlyBudgetCredits: v.optional(v.number()),
      maxActionsPerRun: v.number(),
      successMetric: v.string(),
      role: agentRoleValidator,
      profileUpdatedAt: v.number(),
    })),
    /** Immutable, provenance-labeled feedback context used by this request and its child actions. */
    customAgentFeedbackSnapshot: v.optional(v.object({
      source: v.literal("workspace_member_report"),
      windowDays: v.number(),
      capturedAt: v.number(),
      sampleSize: v.number(),
      helpful: v.number(),
      needsWork: v.number(),
      notes: v.array(v.object({ rating: v.union(v.literal("helpful"), v.literal("needs_work")), note: v.string(), updatedAt: v.number() })),
    })),
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
    /** Hard 1.5x ceiling and provider-call reservations; optional on legacy runs. */
    costCapMicros: v.optional(v.number()),
    inFlightMicros: v.optional(v.number()),
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
    /** Climb AI Basic (Luna) or Expert (Sol drafts; paid only). Absent = basic. */
    aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))),
    /** A quick first take shown while the full job works (JSON: { headline, points[] }). */
    preview: v.optional(v.string()),
    /** The job action and args that continue this run from its checkpoints. */
    resumeWith: v.optional(v.object({ fn: v.string(), args: v.string() })),
    /** Automatic resumes after an interrupted action (reset by an owner retry). */
    resumes: v.optional(v.number()),
    /** Owner retries of a failed run. */
    retries: v.optional(v.number()),
    /** Cost and meters already reconciled by an earlier finish (a retried run settles only the rest). */
    settled: v.optional(v.object({ micros: v.number(), searchCalls: v.number(), imageAttempts: v.number(), scrapeCredits: v.number() })),
    /** When owners were told this run failed (one notice per run). */
    failNoticeAt: v.optional(v.number()),
  })
    .index("by_org_created", ["orgId", "createdAt"])
    .index("by_org_kind_created", ["orgId", "kind", "createdAt"])
    .index("by_org_custom_agent", ["orgId", "customAgentId", "createdAt"])
    .index("by_org_custom_agent_parent", ["orgId", "customAgentId", "customAgentParentRunId"])
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
    /** Provider background response id for a long turn (resumed by the next action instead of rerun). */
    providerRef: v.optional(v.string()),
    /** Worst-case spend held for the current provider turn; reconciled with actual usage. */
    providerCallMicros: v.optional(v.number()),
    providerCallAttempt: v.optional(v.number()),
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
    .index("by_idempotency", ["idempotencyKey"])
    .index("by_artifact", ["artifactId", "createdAt"]),

  /* ---------------- Usage and cost ledger ---------------- */
  usagePeriods: defineTable({
    orgId: v.id("organizations"),
    accountId: v.optional(v.id("accounts")),
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
    .index("by_org_ends", ["orgId", "endsAt"])
    .index("by_account_period", ["accountId", "periodKey"])
    .index("by_account_ends", ["accountId", "endsAt"]),

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
    accountId: v.optional(v.id("accounts")),
    polarCustomerId: v.optional(v.string()),
    email: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_account", ["accountId"])
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
    accountId: v.optional(v.id("accounts")),
    /** Complimentary package granted by staff (no Polar): renews monthly until `until`. */
    comp: v.optional(v.object({ until: v.number(), by: v.id("users"), reason: v.string() })),
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
    .index("by_account", ["accountId"])
    .index("by_polar", ["polarSubscriptionId"]),

  orders: defineTable({
    orgId: v.id("organizations"),
    accountId: v.optional(v.id("accounts")),
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
    .index("by_account", ["accountId"])
    .index("by_polar", ["polarOrderId"])
    .index("by_subscription", ["polarSubscriptionId"])
    .index("by_org", ["orgId"]),

  creditPurchases: defineTable({
    orgId: v.id("organizations"),
    accountId: v.optional(v.id("accounts")),
    polarOrderId: v.string(),
    topupKey: v.string(),
    deliveryCostMicros: v.number(),
    periodId: v.optional(v.id("usagePeriods")),
    status: v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    /** Credit top-ups: granted credits (µUSD), what's left, and when they expire (12 months). */
    creditsMicros: v.optional(v.number()),
    remainingMicros: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_order", ["polarOrderId"])
    .index("by_org", ["orgId"])
    .index("by_account", ["accountId"]),

  /** Per-workspace top-up reservations (top-up credits outlive monthly periods). */
  creditAccounts: defineTable({
    accountId: v.id("accounts"),
    topupReservedMicros: v.number(),
    updatedAt: v.number(),
  }).index("by_account", ["accountId"]),

  /** Per-workspace credit use per period (for optional workspace caps and reporting). */
  workspaceUsage: defineTable({
    orgId: v.id("organizations"),
    periodId: v.id("usagePeriods"),
    reservedMicros: v.number(),
    spentMicros: v.number(),
    updatedAt: v.number(),
  }).index("by_org_period", ["orgId", "periodId"]),

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

  /** Search Console's property-specific query/page aggregates; not universal search volume. */
  searchConsoleSnapshots: defineTable({
    orgId: v.id("organizations"),
    connectionId: v.id("connections"),
    property: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    dataState: v.literal("final"),
    status: v.union(v.literal("syncing"), v.literal("complete"), v.literal("failed")),
    rowCount: v.number(),
    truncated: v.boolean(),
    fetchedAt: v.number(),
    error: v.optional(v.string()),
  })
    .index("by_org_fetched", ["orgId", "fetchedAt"])
    .index("by_fetched", ["fetchedAt"]),

  searchConsoleRows: defineTable({
    orgId: v.id("organizations"),
    snapshotId: v.id("searchConsoleSnapshots"),
    query: v.string(),
    page: v.string(),
    clicks: v.number(),
    impressions: v.number(),
    ctr: v.number(),
    position: v.number(),
  })
    .index("by_snapshot", ["snapshotId"])
    .index("by_org_page", ["orgId", "page"])
    .index("by_org_query", ["orgId", "query"]),

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
    .index("by_org_customer_occurred", ["orgId", "customerRef", "occurredAt"])
    .index("by_org_source_customer_occurred", ["orgId", "source", "customerRef", "occurredAt"])
    .index("by_org_source_event", ["orgId", "source", "sourceEventId"]),

  touches: defineTable({
    orgId: v.id("organizations"),
    customerRef: v.string(),
    source: v.optional(v.string()),
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
    /** Set to owner_reported for manually imported reports; older records have no provenance. */
    spendOrigin: v.optional(v.union(v.literal("owner_reported"), v.literal("platform_reported"))),
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

  /** Precomputed staff dashboards (refreshed by a cron in pages; never one huge read). */
  opsSnapshots: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

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
