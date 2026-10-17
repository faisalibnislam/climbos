import { z } from "zod";
import type { Effort } from "../ai/claude";
import {
  AdDraftsSchema,
  BusinessInsightsSchema,
  ConversionAuditSchema,
  EmailSequenceSchema,
  RetentionPlanSchema,
  SalesSequenceSchema,
  SeoBriefSchema,
  SocialPostsSchema,
  StrategySchema,
  type TaskType,
} from "../ai/tasks";
import type { ModelKey } from "../economics/rates";
import { skillRubric } from "../skills";
import { hookBeforeFold, lintCopy, maxItems, maxLength, minItems } from "./lint";
import type { AgentInput, AgentSpec, LintIssue, PhaseModels, ResearchSpec, Rubric } from "./types";

/**
 * Engine v2 agent definitions: one expert agent per kind of work. Schemas
 * extend the v1 task schemas (additive fields only), so everything that saves
 * or shows v1 output keeps working while the richer fields carry the expert
 * detail. Models and efforts are the starting point; the benchmark decides.
 */

const SONNET: ModelKey = "claude-sonnet-5.5";
const OPUS: ModelKey = "claude-opus-5.5";

/* ---------------- Schemas (v1 + expert fields) ---------------- */

const force = z.enum(["push", "pull", "anxiety", "habit"]);

export const InsightsV2Schema = BusinessInsightsSchema.extend({
  alternatives: z.array(z.object({ name: z.string(), kind: z.enum(["competitor", "diy", "hire", "marketplace", "do_nothing", "other"]), evidence: z.string(), sourceUrl: z.string() })),
  vocPhrases: z.array(z.object({ phrase: z.string(), theme: z.string(), sourceUrl: z.string() })),
  objections: z.array(z.object({ objection: z.string(), force, counter: z.string(), sourceUrl: z.string() })),
  gaps: z.array(z.object({ gap: z.string(), evidence: z.string(), risk: z.string(), sourceUrl: z.string() })),
  positioningStatement: z.string(),
  confidenceNotes: z.string(),
});
export type InsightsV2 = z.infer<typeof InsightsV2Schema>;

export const StrategyV2Schema = StrategySchema.extend({
  diagnosis: z.string(),
  affordableCac: z.string(),
  notDoing: z.array(z.object({ channel: z.string(), why: z.string() })),
  northStar: z.object({ metric: z.string(), baseline: z.string(), target: z.string() }),
  leadingIndicators: z.array(z.object({ metric: z.string(), weeklyTarget: z.string(), source: z.string() })),
  phases: z.array(z.object({ name: z.string(), days: z.string(), focus: z.string() })),
  weekOneChecklist: z.array(z.string()),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })),
});
export type StrategyV2 = z.infer<typeof StrategyV2Schema>;

const postFormat = z.enum(["text", "single_image", "carousel", "document", "reel", "thread", "story"]);
export const SocialPostsV2Schema = z.object({
  posts: z.array(
    SocialPostsSchema.shape.posts.element.extend({
      format: postFormat,
      hook: z.string(),
      slides: z.array(z.object({ heading: z.string(), body: z.string() })),
      videoScript: z.string(),
      visualBrief: z.string(),
      firstComment: z.string(),
    }),
  ),
});
export type SocialPostsV2 = z.infer<typeof SocialPostsV2Schema>;

export const AdDraftsV2Schema = AdDraftsSchema.extend({
  searchAds: z.array(
    AdDraftsSchema.shape.searchAds.element.extend({ paths: z.array(z.string()), negativeKeywords: z.array(z.string()), landingPageMatch: z.string() }),
  ),
  metaAds: z.array(
    AdDraftsSchema.shape.metaAds.element.extend({ concept: z.string(), angle: z.string(), format: z.enum(["image", "video", "carousel"]), creativeBrief: z.string() }),
  ),
});
export type AdDraftsV2 = z.infer<typeof AdDraftsV2Schema>;

export const EmailSequenceV2Schema = EmailSequenceSchema.extend({
  sender: z.string(),
  goal: z.string(),
  successMetric: z.string(),
});

export const SeoBriefV2Schema = SeoBriefSchema.extend({
  pageType: z.enum(["comparison", "alternatives", "service_location", "pricing", "how_to", "product", "category", "other"]),
  intentEvidence: z.string(),
  eeatSignals: z.array(z.string()),
});

export const ConversionAuditV2Schema = ConversionAuditSchema.extend({
  clarityVerdict: z.string(),
  messageMatch: z.string(),
  prioritizedFixes: z.array(z.object({ fix: z.string(), why: z.string(), effort: z.enum(["small", "medium", "large"]), expectedEffect: z.string() })),
});

/* ---------------- Lint ---------------- */

const CHANNEL_SKILL: Record<string, string> = {
  linkedin: "linkedin-posts",
  instagram: "instagram-posts",
  facebook: "facebook-posts",
  x: "x-posts",
  tiktok: "short-video-scripts",
  youtube: "short-video-scripts",
  pinterest: "social-visual-briefs",
};

const CHANNEL_LIMITS: Record<string, { body: number; hashtags: number; fold?: number; emojiPer150: number }> = {
  linkedin: { body: 3000, hashtags: 3, fold: 140, emojiPer150: 1 },
  instagram: { body: 2200, hashtags: 5, fold: 125, emojiPer150: 2 },
  facebook: { body: 63206, hashtags: 2, fold: 125, emojiPer150: 1 },
  x: { body: 280, hashtags: 2, emojiPer150: 1 },
  tiktok: { body: 4000, hashtags: 5, emojiPer150: 2 },
  youtube: { body: 5000, hashtags: 3, emojiPer150: 2 },
  pinterest: { body: 500, hashtags: 5, emojiPer150: 1 },
};

function evidenceOf(input: AgentInput): string {
  return [input.brief, input.facts.join("\n"), input.untrustedContext ?? ""].join("\n");
}

function lintSocial(out: SocialPostsV2, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = [];
  out.posts.forEach((p, i) => {
    const lim = CHANNEL_LIMITS[p.channel] ?? CHANNEL_LIMITS.instagram;
    const path = `posts[${i}]`;
    issues.push(
      ...lintCopy({ body: p.body, slides: p.slides, script: p.videoScript, firstComment: p.firstComment }, { evidence: evidenceOf(input), emojiPer150: lim.emojiPer150 }).map((l) => ({ ...l, path: `${path}.${l.path ?? ""}` })),
      ...maxLength(p.body, lim.body, `${path}.body`, "Post"),
      ...maxItems(p.hashtags, lim.hashtags, `${path}.hashtags`, "hashtags"),
      ...(lim.fold ? hookBeforeFold(p.body, lim.fold, `${path}.body`) : []),
    );
    if (p.format === "carousel" || p.format === "document") issues.push(...minItems(p.slides, 3, `${path}.slides`, "slides for a carousel"), ...maxItems(p.slides, 20, `${path}.slides`, "slides"));
    if (p.format === "reel" && !p.videoScript.trim()) issues.push({ severity: "error", rule: "missing", message: "A Reel needs a script.", path: `${path}.videoScript` });
    if (!p.altText.trim() && p.format !== "text" && p.format !== "thread") issues.push({ severity: "error", rule: "accessibility", message: "Visual posts need alt text.", path: `${path}.altText` });
  });
  return issues;
}

function lintAds(out: AdDraftsV2, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = [...lintCopy(out, { evidence: evidenceOf(input), skip: (p) => /keywords|finalUrl|negative/i.test(p) })];
  out.searchAds.forEach((a, i) => {
    const path = `searchAds[${i}]`;
    issues.push(...minItems(a.headlines, 3, `${path}.headlines`, "headlines"), ...maxItems(a.headlines, 15, `${path}.headlines`, "headlines"));
    issues.push(...minItems(a.descriptions, 2, `${path}.descriptions`, "descriptions"), ...maxItems(a.descriptions, 4, `${path}.descriptions`, "descriptions"));
    a.headlines.forEach((h, j) => issues.push(...maxLength(h, 30, `${path}.headlines[${j}]`, "Headline")));
    a.descriptions.forEach((d, j) => issues.push(...maxLength(d, 90, `${path}.descriptions[${j}]`, "Description")));
    a.paths.forEach((p, j) => issues.push(...maxLength(p, 15, `${path}.paths[${j}]`, "Display path")));
    if (/\p{Extended_Pictographic}/u.test([...a.headlines, ...a.descriptions].join(" "))) issues.push({ severity: "error", rule: "emoji", message: "Google search ads can't use emoji.", path });
  });
  out.metaAds.forEach((m, i) => {
    issues.push(...maxLength(m.headline, 40, `metaAds[${i}].headline`, "Headline"));
    issues.push(...hookBeforeFold(m.primaryText, 125, `metaAds[${i}].primaryText`));
  });
  return issues;
}

function lintGeneric(out: unknown, input: AgentInput): LintIssue[] {
  return lintCopy(out, { evidence: evidenceOf(input), skip: (p) => /url|sourceUrl|keywords|key$/i.test(p) });
}

/* ---------------- Rubrics ---------------- */

/** A primary skill's rubric, with other skills' checklists available to the critic via criticSkills. */
function rubricOf(id: string): Rubric {
  return skillRubric(id);
}

/* ---------------- Specs ---------------- */

interface SpecOptions {
  models?: Partial<PhaseModels>;
  effort?: Partial<Record<"research" | "draft" | "critic", Effort>>;
  maxRevisions?: number;
}

function base<T>(s: Omit<AgentSpec<T>, "models" | "effort" | "maxTokens" | "maxRevisions"> & Partial<Pick<AgentSpec<T>, "maxTokens">>, o: SpecOptions, defaults: { draft: ModelKey }): AgentSpec<T> {
  return {
    ...s,
    models: { research: SONNET, draft: defaults.draft, critic: OPUS, ...o.models },
    effort: { research: "medium", draft: "high", critic: "medium", ...o.effort },
    // Thinking counts against max_tokens (Opus always thinks), so leave generous headroom.
    maxTokens: s.maxTokens ?? { research: 24_000, draft: 32_000, critic: 16_000 },
    maxRevisions: o.maxRevisions ?? 2,
  };
}

export function insightsSpec(o: SpecOptions = {}): AgentSpec<InsightsV2> {
  return base(
    {
      id: "business_insights",
      role: "cmo",
      label: "Business insights",
      skills: ["voc-research", "competitor-teardown", "positioning"],
      schema: InsightsV2Schema,
      rubric: rubricOf("positioning"),
      criticSkills: ["competitor-teardown", "voc-research"],
      lint: lintGeneric,
    },
    o,
    { draft: OPUS },
  );
}

export function strategySpec(o: SpecOptions = {}): AgentSpec<StrategyV2> {
  return base(
    {
      id: "growth_strategy",
      role: "ceo",
      label: "Growth plan",
      skills: ["growth-strategy", "experiment-design"],
      schema: StrategyV2Schema,
      rubric: rubricOf("growth-strategy"),
      criticSkills: ["experiment-design", "positioning"],
      lint: (out, input) => {
        const issues = lintGeneric(out, input);
        if (out.channels.length > 3) issues.push({ severity: "error", rule: "focus", message: `${out.channels.length} active channels; pick 1 primary + 1 secondary (3 at most) and put the rest in "not doing".`, path: "channels" });
        if (out.weekOneChecklist.length > 5) issues.push({ severity: "warn", rule: "focus", message: "Week-1 checklist should have at most 5 items.", path: "weekOneChecklist" });
        return issues;
      },
    },
    o,
    { draft: OPUS },
  );
}

export function socialSpec(channels: string[], o: SpecOptions = {}): AgentSpec<SocialPostsV2> {
  const channelSkills = [...new Set(channels.map((c) => CHANNEL_SKILL[c] ?? "instagram-posts"))];
  const primary = channelSkills[0] ?? "instagram-posts";
  const needsVideo = channels.some((c) => c === "tiktok" || c === "youtube");
  return base(
    {
      id: "social_posts",
      role: "social_media_manager",
      label: "Social posts",
      skills: ["copy-fundamentals", ...channelSkills, "social-visual-briefs", ...(needsVideo || channelSkills.includes("instagram-posts") ? ["short-video-scripts"] : [])].filter((v, i, a) => a.indexOf(v) === i),
      schema: SocialPostsV2Schema,
      rubric: rubricOf(primary),
      criticSkills: ["copy-fundamentals", ...channelSkills.slice(1)],
      lint: lintSocial,
    },
    o,
    { draft: SONNET },
  );
}

export function adsSpec(o: SpecOptions = {}): AgentSpec<AdDraftsV2> {
  return base(
    { id: "ad_drafts", role: "ads_manager", label: "Ad drafts", skills: ["copy-fundamentals", "google-ads", "meta-ads"], schema: AdDraftsV2Schema, rubric: rubricOf("google-ads"), criticSkills: ["meta-ads"], lint: lintAds },
    o,
    { draft: SONNET },
  );
}

export function emailSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof EmailSequenceV2Schema>> {
  return base(
    {
      id: "email_sequence",
      role: "customer_success_manager",
      label: "Email sequence",
      skills: ["copy-fundamentals", "lifecycle-email"],
      schema: EmailSequenceV2Schema,
      rubric: rubricOf("lifecycle-email"),
      lint: (out, input) => [...lintGeneric(out, input), ...out.emails.flatMap((e, i) => maxLength(e.subject, 70, `emails[${i}].subject`, "Subject line"))],
    },
    o,
    { draft: SONNET },
  );
}

export function seoSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof SeoBriefV2Schema>> {
  return base(
    {
      id: "seo_brief",
      role: "seo_specialist",
      label: "SEO page",
      skills: ["seo-pages", "copy-fundamentals"],
      schema: SeoBriefV2Schema,
      rubric: rubricOf("seo-pages"),
      lint: (out, input) => [...lintGeneric(out, input), ...maxLength(out.title, 65, "title", "Title"), ...maxLength(out.metaDescription, 160, "metaDescription", "Meta description")],
      maxTokens: { research: 24_000, draft: 40_000, critic: 16_000 },
    },
    o,
    { draft: SONNET },
  );
}

export function conversionAuditSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof ConversionAuditV2Schema>> {
  return base(
    { id: "conversion_audit", role: "cso", label: "Conversion audit", skills: ["conversion-audit", "landing-pages"], schema: ConversionAuditV2Schema, rubric: rubricOf("conversion-audit"), lint: lintGeneric },
    o,
    { draft: SONNET },
  );
}

export function retentionSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof RetentionPlanSchema>> {
  return base(
    { id: "retention_plan", role: "customer_success_manager", label: "Retention plan", skills: ["retention-lifecycle", "lifecycle-email"], schema: RetentionPlanSchema, rubric: rubricOf("retention-lifecycle"), lint: lintGeneric },
    o,
    { draft: SONNET },
  );
}

export function salesSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof SalesSequenceSchema>> {
  return base(
    { id: "sales_sequence", role: "cso", label: "Sales follow-up", skills: ["sales-follow-up", "copy-fundamentals"], schema: SalesSequenceSchema, rubric: rubricOf("sales-follow-up"), lint: lintGeneric },
    o,
    { draft: SONNET },
  );
}

/* ---------------- Social autopilot: weekly calendar ---------------- */

export const SocialCalendarSchema = z.object({
  weekTheme: z.string(),
  pillars: z.array(z.object({ name: z.string(), why: z.string() })),
  slots: z.array(
    z.object({
      channel: z.string(),
      /** 1 = Monday … 7 = Sunday, in the business's time zone. */
      day: z.number(),
      pillar: z.string(),
      purpose: z.enum(["teach", "prove", "connect", "ask"]),
      format: postFormat,
      idea: z.string(),
      angle: z.string(),
      hookDraft: z.string(),
      proof: z.string(),
      callToAction: z.string(),
      needsOwner: z.boolean(),
      ownerNote: z.string(),
    }),
  ),
  learningsApplied: z.array(z.string()),
});
export type SocialCalendar = z.infer<typeof SocialCalendarSchema>;

/** Plans next week's slots; `cadence` is posts per channel this week. */
export function socialCalendarSpec(cadence: Record<string, number>, o: SpecOptions = {}): AgentSpec<SocialCalendar> {
  const channelSkills = [...new Set(Object.keys(cadence).map((c) => CHANNEL_SKILL[c]).filter(Boolean))];
  return base(
    {
      id: "social_calendar",
      role: "social_media_manager",
      label: "Weekly content plan",
      skills: ["social-calendar", "positioning", ...channelSkills.slice(0, 2)],
      schema: SocialCalendarSchema,
      rubric: rubricOf("social-calendar"),
      criticSkills: ["copy-fundamentals"],
      lint: (out, input) => {
        const issues = lintCopy({ theme: out.weekTheme, slots: out.slots.map((s) => ({ idea: s.idea, hook: s.hookDraft })) }, { evidence: evidenceOf(input) });
        for (const [channel, n] of Object.entries(cadence)) {
          const got = out.slots.filter((s) => s.channel === channel).length;
          if (got !== n) issues.push({ severity: "error", rule: "count", message: `${channel} needs exactly ${n} slot${n === 1 ? "" : "s"}; the plan has ${got}.`, path: "slots" });
        }
        out.slots.forEach((s, i) => {
          if (!(s.channel in cadence)) issues.push({ severity: "error", rule: "channel", message: `"${s.channel}" isn't one of this week's channels.`, path: `slots[${i}].channel` });
          if (!Number.isInteger(s.day) || s.day < 1 || s.day > 7) issues.push({ severity: "error", rule: "day", message: "day must be 1 (Monday) to 7 (Sunday).", path: `slots[${i}].day` });
        });
        const ideas = out.slots.map((s) => s.idea.trim().toLowerCase());
        if (new Set(ideas).size !== ideas.length) issues.push({ severity: "error", rule: "duplicate", message: "Two slots share the same idea; every slot needs its own.", path: "slots" });
        if (out.pillars.length > 4) issues.push({ severity: "warn", rule: "focus", message: "More than 4 pillars dilutes the week.", path: "pillars" });
        return issues;
      },
      maxTokens: { research: 16_000, draft: 24_000, critic: 16_000 },
    },
    o,
    { draft: SONNET },
  );
}

/** Research briefs per job (what the research phase should find). */
export function researchFor(task: TaskType | "business_insights", ctx: { website?: string; businessName: string; country?: string }): ResearchSpec | undefined {
  const site = ctx.website ? ` (${ctx.website})` : "";
  switch (task) {
    case "business_insights":
      return {
        maxSearches: 8,
        maxFetches: 8,
        brief: `For ${ctx.businessName}${site}:
1. Competitive set: 3-5 direct competitors customers actually consider, plus 2-3 real alternatives (DIY, hiring, marketplaces, doing nothing). For each competitor capture their homepage headline/claim, entry price and offer, and one weakness customers mention.
2. Voice of customer: find reviews and forum threads (G2/Capterra/Trustpilot/Google reviews/Reddit/app stores, whichever fit this business type) about this business and its top competitors. Collect 15-30 short verbatim phrases with URLs: why people switch, what almost stopped them, outcomes they describe, words they use for the problem.
3. Gaps: values customers mention that no competitor leads with; offers nobody makes (guarantee, fixed price, fast start); channels competitors are absent from. Note evidence for each.`,
      };
    case "seo_brief":
      return {
        maxSearches: 5,
        maxFetches: 4,
        brief: `Search the target query and close variants. Record what currently ranks (page types, angles, gaps), whether an AI Overview appears, and the questions searchers ask. Fetch the top 2-3 results to see what they cover and miss.`,
      };
    case "ad_drafts":
      return {
        maxSearches: 3,
        maxFetches: 3,
        brief: `Look for competitors' current ads and offers (Google results for the main keywords, competitor landing pages) and the exact phrases buyers use. Note claims competitors make so ours can differ.`,
      };
    case "conversion_audit":
      return { maxSearches: 2, maxFetches: 4, brief: `Fetch the business's money page(s) and 1-2 competitor equivalents. Note headline, offer, proof, CTA, objections handled and friction.` };
    default:
      return undefined;
  }
}

export type AnyAgentSpec = AgentSpec<unknown>;
