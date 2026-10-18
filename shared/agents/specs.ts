import { z } from "zod";
import { lintWordCaps, PLAN_CAPS, PLAYS_CAPS } from "./wordCaps";
import { lintEconomics, withForecasts, type Economics } from "./economics";
import type { Effort } from "../ai/types";
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

import { routeModels } from "./routes";


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

/** A growth play card (skills/growth-plays): creative, forecast with base rates, testable. */
export const PlaySchema = z.object({
  name: z.string(),
  oneLiner: z.string(),
  kind: z.enum(["bankable", "creative", "moonshot"]),
  /** Who and where, with size when known, e.g. "HR managers in Austin · SHRM Austin chapter (1,200 members)". */
  audience: z.string(),
  trigger: z.string(),
  hook: z.string(),
  mechanic: z.string(),
  assetUsed: z.string(),
  /** One step per line: "500 postcards → calls: 1–4.5%, plan 2% [source.com, C]". */
  funnel: z.array(z.string()),
  unit: z.string(),
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
  horizonDays: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  biggestUnknown: z.string(),
  /** Size, budget and duration, e.g. "500 cards · $260 · 21 days". */
  test: z.string(),
  killIf: z.string(),
  scaleIf: z.string(),
  /** 1-5 each: fit, predictability, leverage, timeToSignal, compounding, cost, risk, distinctiveness. */
  scores: z.array(z.number()),
  firstActionToday: z.string(),
  climbosCanDo: z.string(),
  /** The play's numbers; ClimbOS code (not the model) turns them into customers, cost per customer and payback. */
  model: z.object({
    /** Right-fit people reached per week at the planned volume, with a realistic low and high. */
    weeklyReach: z.number(),
    weeklyReachLow: z.number(),
    weeklyReachHigh: z.number(),
    /** Funnel steps from reach to a paying customer; rate = most-likely share passing (0–1), low/high = the cited range. */
    steps: z.array(z.object({ name: z.string(), rate: z.number(), low: z.number(), high: z.number() })),
    monthlySpendUsd: z.number(),
    ownerHoursPerWeek: z.number(),
  }),
});
export type Play = z.infer<typeof PlaySchema>;
/** What the plays agent writes: no forecast numbers (ClimbOS code computes P10/P50/P90 from the model). */
export const PlayDraftSchema = PlaySchema.omit({ p10: true, p50: true, p90: true });
export type PlayDraft = z.infer<typeof PlayDraftSchema>;

export const SCORE_KEYS = ["fit", "predictability", "leverage", "timeToSignal", "compounding", "cost", "risk", "distinctiveness"] as const;
export type PlayScores = Record<(typeof SCORE_KEYS)[number], number>;

export function playScores(p: Pick<Play, "scores">): PlayScores {
  return Object.fromEntries(SCORE_KEYS.map((k, i) => [k, Math.max(1, Math.min(5, Math.round(p.scores[i] ?? 1)))])) as PlayScores;
}

/** Weighted play score (growth-plays rubric), 20–100. */
export function playScore(p: Pick<Play, "scores">): number {
  const s = playScores(p);
  return Math.round(20 * (0.25 * s.fit + 0.2 * s.predictability + 0.15 * s.leverage + 0.1 * s.timeToSignal + 0.1 * s.compounding + 0.1 * s.cost + 0.1 * s.risk));
}

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
/** Saved plans also carry the growth-plays portfolio (produced by its own agent). */
export type StrategyV2 = z.infer<typeof StrategyV2Schema> & { plays?: Play[]; economics?: PlaysOutput["economics"]; webSources?: { url: string; title?: string }[]; snapshot?: PlanSnapshot };
export interface PlanSnapshot { engine: string; aiMode: string; goal: string; horizonDays: number; monthlyAdBudget: number; facts: number; insightsChars: number; ownerEconomics?: unknown }
/** Bump when the plan pipeline changes in a way that could change results. */
export const ENGINE_VERSION = "v2.4-calc";

/** The growth-plays agent's output: 1 bankable, 1-2 creative-proven, at most 1 capped moonshot (≤ 4). */
export const PlaysOutputSchema = z.object({
  /** One or two sentences: why this portfolio, for this business, now. */
  portfolioNote: z.string(),
  /** What one customer is worth (facts first, else labelled assumptions in `basis`). */
  economics: z.object({
    revenuePerCustomerMonthUsd: z.number(),
    /** Contribution margin before acquisition, 0–1. */
    grossMargin: z.number(),
    /** Share of customers lost per month, 0–1. */
    monthlyChurn: z.number(),
    basis: z.string(),
    /** Which inputs are assumptions, not facts. */
    assumed: z.array(z.enum(["revenue", "margin", "churn"])),
  }),
  plays: z.array(PlayDraftSchema),
});
export type PlaysOutput = z.infer<typeof PlaysOutputSchema>;
/** Saved portfolio: the agent's plays plus the forecast ClimbOS computed. */
export type PlaysWithForecast = Omit<PlaysOutput, "plays"> & { plays: Play[] };

const VANITY = /\b(awareness|impressions|engagement|followers|reach|likes|views)\b/i;
const GENERIC = /\b(post consistently|build a community|leverage social media|increase brand awareness|engage with your audience|create valuable content|optimi[sz]e your seo|run targeted ads|start a blog|partner with influencers|go viral|thought leadership|omnichannel|drive engagement)\b/i;

/** Deterministic portfolio checks (growth-plays §3–4). */
const CUSTOMER_UNIT = /customer|client|account|member|order|booking|job|sale|subscriber|patient|student|deal|sign-?up/i;

export function lintPlays(drafts: PlayDraft[], economics?: Economics): LintIssue[] {
  const plays = economics ? withForecasts({ economics, plays: drafts }).plays : (drafts as Play[]);
  const issues: LintIssue[] = [];
  const err = (message: string, path = "plays") => issues.push({ severity: "error", rule: "portfolio", message, path });
  if (plays.length < 2 || plays.length > 4) err(`${plays.length} plays; the portfolio needs 2 to 4.`);
  const scored = plays.map((p) => ({ p, s: playScores(p) }));
  const bankable = scored.filter((x) => x.p.kind === "bankable");
  if (bankable.length !== 1) err(`${bankable.length} bankable plays; exactly one is needed.`);
  if (bankable[0] && bankable[0].s.predictability < 4) err("The bankable play needs predictability ≥ 4.");
  if (!scored.some((x) => x.p.kind === "creative" && x.s.distinctiveness >= 4 && x.s.predictability >= 3)) err("At least one creative play needs distinctiveness ≥ 4 and predictability ≥ 3 (a proven mechanic on a non-obvious audience, asset or moment).");
  if (plays.filter((p) => p.kind === "moonshot").length > 1) err("At most one moonshot.");
  // Ambition: the portfolio must credibly move the goal, not run a cautious measurement exercise.
  const customerLike = plays.filter((p) => CUSTOMER_UNIT.test(p.unit));
  const combined = customerLike.reduce((s, p) => s + p.p50, 0);
  if (customerLike.length && combined < 2) err(`The plays add up to ${Math.round(combined * 10) / 10} ${customerLike[0].unit} at P50 — too small to move the goal. Add a bankable demand-generation play that reaches enough of the right people (with a weekly volume), or raise the volume of the existing ones.`);
  else if (customerLike.length && combined < 5) issues.push({ severity: "warn", rule: "portfolio", message: `Combined P50 is only ${Math.round(combined * 10) / 10} ${customerLike[0].unit}; check the volumes are big enough to matter.`, path: "plays" });
  scored.forEach(({ p, s }, i) => {
    const path = `plays[${i}]`;
    if (p.scores.length !== 8) err("scores needs 8 numbers in order: fit, predictability, leverage, timeToSignal, compounding, cost, risk, distinctiveness.", `${path}.scores`);
    if (p.funnel.length < 2) err("The forecast needs a funnel with at least 2 steps.", `${path}.funnel`);
    if (VANITY.test(p.unit)) err(`"${p.unit}" is a vanity unit; use booked jobs, customers, members or revenue.`, `${path}.unit`);
    p.funnel.forEach((line, j) => {
      if (!/\[[^\]]+\]/.test(line) && !/assumption|grade d/i.test(line)) err("Every funnel step needs a [source, grade] or 'assumption, grade D'.", `${path}.funnel[${j}]`);
    });
    if (!p.killIf.trim() || !p.scaleIf.trim()) err("Every play needs kill and scale rules.", path);
    if (!p.audience.trim() || !p.hook.trim()) err("Every play needs a named audience and place, and an exact hook.", path);
    if (p.kind === "moonshot" && s.predictability > 2) issues.push({ severity: "warn", rule: "portfolio", message: "A moonshot with predictability > 2 could be a creative play instead.", path });
    if (GENERIC.test(`${p.name} ${p.oneLiner} ${p.mechanic}`)) issues.push({ severity: "warn", rule: "generic", message: "Generic phrasing; name the audience, hook and number in the same sentence.", path });
  });
  return issues;
}

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

/** Below this, a feed post reads as a stub (blind reviews penalised clipped Facebook and LinkedIn copy). */
const MIN_BODY_WORDS: Record<string, number> = { facebook: 40, linkedin: 50 };

/** Everything the writer was given: numbers in any prompt block trace (brief, facts, research, the task's inputs). */
function evidenceOf(input: AgentInput): string {
  return [input.brief, input.facts.join("\n"), input.untrustedContext ?? "", input.task].join("\n");
}

/** The output's own numeric fields (rates also as percentages), so prose may restate them. */
export function ownNumbers(v: unknown, out: string[] = []): string[] {
  if (typeof v === "number" && Number.isFinite(v)) {
    out.push(String(v));
    if (v > 0 && v < 1) out.push(String(Math.round(v * 10_000) / 100));
  } else if (Array.isArray(v)) v.forEach((x) => ownNumbers(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => ownNumbers(x, out));
  return out;
}

/** Domains named in "[source, grade]" funnel citations must be in what the writer was given (research notes, brief, facts). */
export function lintCitations(plays: { funnel: string[] }[], evidence: string): LintIssue[] {
  const ev = evidence.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");
  const issues: LintIssue[] = [];
  plays.forEach((p, i) =>
    p.funnel.forEach((line, j) => {
      const src = line.match(/\[([^\]]+?),\s*[ABCD]\]\s*$/)?.[1]?.trim().toLowerCase();
      const domain = src?.match(/([a-z0-9-]+\.)+[a-z]{2,}/)?.[0]?.replace(/^www\./, "");
      if (domain && !ev.includes(domain))
        issues.push({ severity: "error", rule: "citation", message: `"${domain}" isn't in your research notes or the brief. Cite a source you actually read, or mark the rate "assumption, grade D".`, path: `plays[${i}].funnel[${j}]` });
    }),
  );
  return issues;
}

/** Plans and plays: numbers trace to any input or the output's own model; labelled assumptions and targets pass. */
function lintPlanning(out: unknown, input: AgentInput): LintIssue[] {
  return lintCopy(out, { evidence: `${evidenceOf(input)}\n${ownNumbers(out).join(" ")}`, labelled: true, skip: (p) => /url|sourceUrl|keywords|key$|killIf|scaleIf|days$|weeklyTarget|target$/i.test(p) });
}

function lintSocial(out: SocialPostsV2, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = [];
  out.posts.forEach((p, i) => {
    const lim = CHANNEL_LIMITS[p.channel] ?? CHANNEL_LIMITS.instagram;
    const path = `posts[${i}]`;
    issues.push(
      ...lintCopy({ body: p.body, slides: p.slides, script: p.videoScript, firstComment: p.firstComment }, { evidence: evidenceOf(input), emojiPer150: lim.emojiPer150, publishable: true }).map((l) => ({ ...l, path: `${path}.${l.path ?? ""}` })),
      // Briefs and alt text are complete too: no owner questions hidden in them.
      ...lintCopy({ title: p.title, hook: p.hook, visualBrief: p.visualBrief, altText: p.altText, imageIdea: p.imageIdea }, { publishable: true }).filter((l) => l.rule === "placeholder").map((l) => ({ ...l, path: `${path}.${l.path ?? ""}` })),
      ...maxLength(p.body, lim.body, `${path}.body`, "Post"),
      ...maxItems(p.hashtags, lim.hashtags, `${path}.hashtags`, "hashtags"),
      ...(lim.fold ? hookBeforeFold(p.body, lim.fold, `${path}.body`) : []),
    );
    if (p.format === "carousel" || p.format === "document") issues.push(...minItems(p.slides, 3, `${path}.slides`, "slides for a carousel"), ...maxItems(p.slides, 20, `${path}.slides`, "slides"));
    if (p.format === "reel" && !p.videoScript.trim()) issues.push({ severity: "error", rule: "missing", message: "A Reel needs a script.", path: `${path}.videoScript` });
    if (!p.altText.trim() && p.format !== "text" && p.format !== "thread") issues.push({ severity: "error", rule: "accessibility", message: "Visual posts need alt text.", path: `${path}.altText` });
    issues.push(...lintVoice([p.body, ...p.slides, p.videoScript, p.firstComment].join("\n"), path));
    const minWords = MIN_BODY_WORDS[p.channel];
    const words = p.body.split(/\s+/).filter(Boolean).length;
    if (minWords && words < minWords && p.format !== "reel" && p.format !== "story") {
      issues.push({ severity: "error", rule: "thin", message: `${p.channel} post body is ${words} words; write ${minWords}-150 (hook, why it matters, proof, one next step).`, path: `${path}.body` });
    }
    const promised = promisedCount([p.title, p.hook, p.altText].join(" "));
    if (promised && (p.format === "carousel" || p.format === "document") && p.slides.length < promised + 1) {
      issues.push({ severity: "error", rule: "promise", message: `The post promises ${promised} items but has ${p.slides.length} slides (with the cover). Deliver every item or change the number.`, path: `${path}.slides` });
    }
  });
  return issues;
}

/** Own-channel copy speaks as the brand; reviewer-style third person reads as an outsider. */
export function lintVoice(text: string, path: string): LintIssue[] {
  const m = text.match(/\b(?:the (?:team|company|brand|founders?|business) (?:says|claims|notes|admits|states)|the (?:site|website|company)'s own (?:claim|words)|according to (?:the|their) (?:site|website|homepage))\b/i);
  return m ? [{ severity: "error", rule: "voice", message: `Write as the brand ("we", "our"), not about it: "${m[0]}".`, path }] : [];
}

/** "6 things", "five ways": the number a title or hook promises. */
export function promisedCount(text: string): number | null {
  const words: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const m = text.match(/\b(\d{1,2}|three|four|five|six|seven|eight|nine|ten) (?:things|ways|reasons|tips|mistakes|steps|signs|ideas|myths|questions|rules|lessons)\b/i);
  if (!m) return null;
  const n = words[m[1].toLowerCase()] ?? Number(m[1]);
  return n >= 3 && n <= 20 ? n : null;
}

function lintAds(out: AdDraftsV2, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = [...lintCopy(out, { evidence: evidenceOf(input), publishable: true, skip: (p) => /keywords|finalUrl|negative|creativeBrief|landingPageMatch/i.test(p) })];
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

/** Lint for things that get published or sent as written (emails, pages): no placeholders. */
function lintPublishable(out: unknown, input: AgentInput): LintIssue[] {
  return lintCopy(out, { evidence: evidenceOf(input), publishable: true, skip: (p) => /url|sourceUrl|keywords|key$|intentEvidence|eeatSignals|outline|goal|successMetric/i.test(p) });
}

/* ---------------- Rubrics ---------------- */

/** A primary skill's rubric, with other skills' checklists available to the critic via criticSkills. */
function rubricOf(id: string): Rubric {
  return skillRubric(id);
}

/** Which play catalogs a business type gets (keeps prompts focused). */
export function playCatalogsFor(type: string | null | undefined): string[] {
  switch (type) {
    case "saas":
    case "b2b_saas":
    case "creator_saas":
    case "b2b_service":
    case "agency":
      return ["plays-saas-b2b"];
    case "ecommerce":
    case "physical_products":
    case "b2c_app":
    case "creator":
      return ["plays-ecommerce-consumer"];
    case "services":
    case "local_service":
    case "local_food":
    case "local_fitness":
      return ["plays-local"];
    default:
      return ["plays-local", "plays-saas-b2b"];
  }
}

/* ---------------- Specs ---------------- */

interface SpecOptions {
  models?: Partial<PhaseModels>;
  effort?: Partial<Record<"research" | "draft" | "critic", Effort>>;
  maxRevisions?: number;
  shipOn?: "gates" | "rubric";
}

/**
 * Engine v2.2 (final, chosen by benchmark Phase A2):
 * - "expert" jobs (insights, strategy, weekly plan): Opus drafts, an Opus
 *   reviewer scores the full rubric, at most one revision.
 * - "lean" jobs (publishable content, audits, plans for owners): Opus drafts
 *   once with the skills; a fast Sonnet reviewer only checks hard gates and
 *   lint, and one revision happens only when something actually fails.
 */
type Profile = "expert" | "lean";

const TOKEN_FLOORS = { research: 16_000, draft: 24_000, critic: 12_000 };
function withFloors(m: { research: number; draft: number; critic: number }) {
  return { research: Math.max(m.research, TOKEN_FLOORS.research), draft: Math.max(m.draft, TOKEN_FLOORS.draft), critic: Math.max(m.critic, TOKEN_FLOORS.critic) };
}

function base<T>(s: Omit<AgentSpec<T>, "models" | "effort" | "maxTokens" | "maxRevisions" | "shipOn"> & Partial<Pick<AgentSpec<T>, "maxTokens">>, o: SpecOptions, profile: Profile): AgentSpec<T> {
  const lean = profile === "lean";
  return {
    ...s,
    // Basic routes; runAgentTask applies the run's mode. Explicit overrides (benchmark arms, tests) win.
    models: { ...routeModels(s.id), ...o.models },
    effort: { research: "medium", draft: "high", critic: lean ? "low" : "medium", ...o.effort },
    // OpenAI reasoning tokens count against max output tokens: keep floors so thinking never crowds out the answer.
    maxTokens: withFloors(s.maxTokens ?? { research: 24_000, draft: 32_000, critic: 16_000 }),
    maxRevisions: o.maxRevisions ?? 1,
    shipOn: o.shipOn ?? (lean ? "gates" : "rubric"),
    ownerFacing: s.ownerFacing ?? !lean,
  };
}

export function insightsSpec(o: SpecOptions = {}): AgentSpec<InsightsV2> {
  return base(
    {
      id: "business_insights",
      role: "cmo",
      label: "Business insights",
      skills: ["owner-brevity", "voc-research", "competitor-teardown", "positioning"],
      schema: InsightsV2Schema,
      rubric: rubricOf("positioning"),
      criticSkills: ["competitor-teardown", "voc-research"],
      lint: lintGeneric,
    },
    o,
    "expert",
  );
}

/** Growth plays: the creative, predictable portfolio the plan is built around. */
export function growthPlaysSpec(o: SpecOptions = {}, catalogs: string[] = playCatalogsFor(null)): AgentSpec<PlaysOutput> {
  return base(
    {
      id: "growth_plays",
      role: "cmo",
      label: "Growth plays",
      skills: ["owner-brevity", "growth-plays", ...catalogs],
      schema: PlaysOutputSchema,
      rubric: rubricOf("growth-plays"),
      criticSkills: ["positioning", "experiment-design"],
      maxTokens: { research: 24_000, draft: 40_000, critic: 16_000 },
      lint: (out, input) => [...lintPlanning(out, input), ...lintCitations(out.plays, evidenceOf(input)), ...lintPlays(out.plays, out.economics), ...lintWordCaps(out, PLAYS_CAPS), ...lintEconomics(out)],
    },
    o,
    "expert",
  );
}

export function strategySpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof StrategyV2Schema>> {
  return base(
    {
      id: "growth_strategy",
      role: "ceo",
      label: "Growth plan",
      skills: ["owner-brevity", "growth-strategy", "experiment-design"],
      schema: StrategyV2Schema,
      rubric: rubricOf("growth-strategy"),
      criticSkills: ["experiment-design", "positioning"],
      lint: (out, input) => {
        const issues = [...lintPlanning(out, input), ...lintWordCaps(out, PLAN_CAPS)];
        if (out.channels.length > 3) issues.push({ severity: "error", rule: "focus", message: `${out.channels.length} active channels; pick 1 primary + 1 secondary (3 at most) and put the rest in "not doing".`, path: "channels" });
        if (out.weekOneChecklist.length > 5) issues.push({ severity: "warn", rule: "focus", message: "Week-1 checklist should have at most 5 items.", path: "weekOneChecklist" });
        // Owner-ready: a number to aim at, and a summary that says what to expect.
        if (!/\d/.test(out.northStar?.target ?? "")) issues.push({ severity: "error", rule: "ambition", message: "The North Star target needs a number and a date (e.g. \"20 new paying customers by day 90\"). Use the plays' P50; say it's an estimate.", path: "northStar.target" });
        if (!/\d/.test(out.summary ?? "")) issues.push({ severity: "warn", rule: "ambition", message: "The summary should say what to expect in numbers (the plays' combined P50 over 90 days).", path: "summary" });
        if (/not a forecast|do not scale until|until (actual|verified) (cac|economics)/i.test(out.summary ?? "")) issues.push({ severity: "warn", rule: "ambition", message: "The summary reads as a validation exercise. Lead with the expected outcome and the engine; keep caveats in kill rules.", path: "summary" });
        return issues;
      },
    },
    o,
    "expert",
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
    "lean",
  );
}

export function adsSpec(o: SpecOptions = {}): AgentSpec<AdDraftsV2> {
  return base(
    { id: "ad_drafts", role: "ads_manager", label: "Ad drafts", skills: ["copy-fundamentals", "google-ads", "meta-ads"], schema: AdDraftsV2Schema, rubric: rubricOf("google-ads"), criticSkills: ["meta-ads"], lint: lintAds },
    o,
    "lean",
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
      lint: (out, input) => [...lintPublishable(out, input), ...out.emails.flatMap((e, i) => maxLength(e.subject, 70, `emails[${i}].subject`, "Subject line"))],
    },
    o,
    "lean",
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
      lint: (out, input) => [...lintPublishable(out, input), ...maxLength(out.title, 65, "title", "Title"), ...maxLength(out.metaDescription, 160, "metaDescription", "Meta description")],
      maxTokens: { research: 24_000, draft: 40_000, critic: 16_000 },
    },
    o,
    "lean",
  );
}

export function conversionAuditSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof ConversionAuditV2Schema>> {
  return base(
    { id: "conversion_audit", role: "cso", label: "Conversion audit", skills: ["owner-brevity", "conversion-audit", "landing-pages"], schema: ConversionAuditV2Schema, rubric: rubricOf("conversion-audit"), lint: lintGeneric },
    o,
    "lean",
  );
}

export function retentionSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof RetentionPlanSchema>> {
  return base(
    { id: "retention_plan", role: "customer_success_manager", label: "Retention plan", skills: ["owner-brevity", "retention-lifecycle", "lifecycle-email"], schema: RetentionPlanSchema, rubric: rubricOf("retention-lifecycle"), lint: lintGeneric },
    o,
    "lean",
  );
}

export function salesSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof SalesSequenceSchema>> {
  return base(
    { id: "sales_sequence", role: "cso", label: "Sales follow-up", skills: ["sales-follow-up", "copy-fundamentals"], schema: SalesSequenceSchema, rubric: rubricOf("sales-follow-up"), lint: lintGeneric },
    o,
    "lean",
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
      skills: ["owner-brevity", "social-calendar", "positioning", ...channelSkills.slice(0, 2)],
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
    "expert",
  );
}

/* ---------------- Acquisition intelligence: classify, then score channels ---------------- */

export const ChannelFitSchema = z.object({
  /** 1-3 library business type keys, most specific first. */
  types: z.array(z.string()),
  dimensions: z.array(z.object({ key: z.string(), value: z.string(), confidence: z.enum(["high", "medium", "low"]), evidence: z.string() })),
  channels: z.array(
    z.object({
      id: z.string(),
      /** Changes to the 8 factor priors, in order: audience, intent, budget, time, feasibility, competition, scalability, measurement. Each −30…+30; 0 = keep. */
      deltas: z.array(z.number()),
      reason: z.string(),
      evidence: z.string(),
      platform: z.string(),
      tactic: z.string(),
      audience: z.string(),
    }),
  ),
  /** Two short bullets for the owner: what wins and why. */
  summary: z.array(z.string()),
});
export type ChannelFit = z.infer<typeof ChannelFitSchema>;

function lintChannelFit(out: ChannelFit, input: AgentInput, candidateIds: string[], typeKeys: string[], dims: Record<string, readonly string[]>): LintIssue[] {
  const issues: LintIssue[] = lintCopy({ summary: out.summary, reasons: out.channels.map((c) => c.reason) }, { evidence: evidenceOf(input) });
  if (!out.types.length || out.types.length > 3) issues.push({ severity: "error", rule: "types", message: "Pick 1-3 business types.", path: "types" });
  out.types.forEach((t, i) => {
    if (!typeKeys.includes(t)) issues.push({ severity: "error", rule: "types", message: `"${t}" isn't a library type. Use one of: ${typeKeys.join(", ")}.`, path: `types[${i}]` });
  });
  out.dimensions.forEach((d, i) => {
    const allowed = dims[d.key];
    if (!allowed) issues.push({ severity: "error", rule: "dimension", message: `Unknown dimension "${d.key}".`, path: `dimensions[${i}]` });
    else if (!allowed.includes(d.value)) issues.push({ severity: "error", rule: "dimension", message: `${d.key} must be one of: ${allowed.join(", ")}.`, path: `dimensions[${i}].value` });
  });
  if (out.channels.length < 8) issues.push({ severity: "error", rule: "count", message: "Review at least 8 candidate channels.", path: "channels" });
  out.channels.forEach((c, i) => {
    const path = `channels[${i}]`;
    if (!candidateIds.includes(c.id)) issues.push({ severity: "error", rule: "channel", message: `${c.id} isn't in the candidate list.`, path });
    if (c.deltas.length !== 8) issues.push({ severity: "error", rule: "deltas", message: "deltas needs 8 numbers in factor order.", path: `${path}.deltas` });
    if (c.deltas.some((d) => Math.abs(d) > 30)) issues.push({ severity: "error", rule: "deltas", message: "Each delta is between −30 and +30.", path: `${path}.deltas` });
    if (c.deltas.some((d) => d !== 0) && !c.evidence.trim()) issues.push({ severity: "error", rule: "evidence", message: "Any change needs evidence (a source, a confirmed fact or the owner's data).", path: `${path}.evidence` });
  });
  return issues;
}

/** Scores the library's candidate channels for this business with evidence (Acquisition Intelligence). */
export function channelFitSpec(ctx: { candidateIds: string[]; typeKeys: string[]; dims: Record<string, readonly string[]> }, o: SpecOptions = {}): AgentSpec<ChannelFit> {
  return base(
    {
      id: "channel_fit",
      role: "cmo",
      label: "Channel scoring",
      skills: ["owner-brevity", "growth-strategy", "positioning"],
      schema: ChannelFitSchema,
      rubric: rubricOf("growth-strategy"),
      criticSkills: ["growth-strategy"],
      lint: (out, input) => lintChannelFit(out, input, ctx.candidateIds, ctx.typeKeys, ctx.dims),
      maxTokens: { research: 8_000, draft: 16_000, critic: 8_000 },
    },
    // One pass, no review: deterministic rules and sanitising (mergeFit, adjustmentsFrom) carry the structure.
    { maxRevisions: -1, ...o },
    "lean",
  );
}

/* ---------------- Outbound: find the people, write the emails ---------------- */

export const ProspectsOutputSchema = z.object({
  icp: z.object({
    /** One sentence: who, where, what situation. */
    summary: z.string(),
    mustHaves: z.array(z.string()),
    disqualifiers: z.array(z.string()),
    triggers: z.array(z.string()),
    /** The role that owns the problem, e.g. "Owner" or "Head of marketing". */
    decisionMaker: z.string(),
  }),
  prospects: z.array(
    z.object({
      company: z.string(),
      website: z.string(),
      location: z.string(),
      /** "1-10", "11-50", "51-200" or "unknown". */
      sizeBand: z.string(),
      /** One line: why they need this business now. */
      why: z.string(),
      evidence: z.array(z.object({ url: z.string(), observation: z.string() })),
      /** A dated or observable trigger, or "". */
      trigger: z.string(),
      fit: z.number(),
      timing: z.number(),
      /** Who to contact: a name and title only if published on their own site, else the role. */
      contact: z.string(),
      /** A published contact email copied verbatim from the evidence, else "". */
      publicEmail: z.string(),
    }),
  ),
  excluded: z.array(z.object({ company: z.string(), reason: z.string() })),
});
export type ProspectsOutput = z.infer<typeof ProspectsOutputSchema>;

export const OutreachOutputSchema = z.object({
  sequence: z.array(
    z.object({
      /** Business days after the first email (0, 3, 7, 14). */
      day: z.number(),
      subject: z.string(),
      /** Plain text. Use {{firstLine}} where the personal opener goes in step 1; no greeting name, no footer. */
      body: z.string(),
      purpose: z.string(),
    }),
  ),
  firstLines: z.array(z.object({ company: z.string(), line: z.string() })),
  /** At most 3 bullets for the owner: what to check before sending. */
  ownerNotes: z.array(z.string()),
});
export type OutreachOutput = z.infer<typeof OutreachOutputSchema>;

function lintProspects(out: ProspectsOutput, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = lintCopy({ icp: out.icp.summary }, { evidence: evidenceOf(input) });
  if (out.prospects.length < 3) issues.push({ severity: "error", rule: "count", message: "Find at least 3 qualified companies, or explain in excluded why the market is thin.", path: "prospects" });
  const seen = new Set<string>();
  out.prospects.forEach((p, i) => {
    const path = `prospects[${i}]`;
    const host = domainOf(p.website);
    if (!host) issues.push({ severity: "error", rule: "source", message: `${p.company}: needs its real website.`, path: `${path}.website` });
    if (host && seen.has(host)) issues.push({ severity: "error", rule: "duplicate", message: `${p.company} is listed twice.`, path });
    if (host) seen.add(host);
    if (!p.evidence.some((e) => /^https?:\/\//.test(e.url))) issues.push({ severity: "error", rule: "evidence", message: `${p.company}: every prospect needs at least one evidence URL.`, path: `${path}.evidence` });
    if (p.publicEmail && !p.evidence.some((e) => e.observation.toLowerCase().includes(p.publicEmail.toLowerCase()))) {
      issues.push({ severity: "error", rule: "invented_email", message: `${p.company}: only use an email copied verbatim from a cited page (quote it in evidence).`, path: `${path}.publicEmail` });
    }
    if (p.fit < 0 || p.fit > 100 || p.timing < 0 || p.timing > 100) issues.push({ severity: "error", rule: "range", message: "fit and timing are 0-100.", path });
  });
  return issues;
}

function lintOutreach(out: OutreachOutput, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = lintCopy({ sequence: out.sequence.map((s) => ({ subject: s.subject, body: s.body.replace(/\{\{firstLine\}\}/g, "") })), firstLines: out.firstLines.map((f) => f.line) }, { evidence: evidenceOf(input), publishable: true });
  if (out.sequence.length < 2 || out.sequence.length > 5) issues.push({ severity: "error", rule: "count", message: "Write 2-5 steps.", path: "sequence" });
  out.sequence.forEach((s, i) => {
    const words = s.body.replace(/\{\{firstLine\}\}/g, "").split(/\s+/).filter(Boolean).length;
    const max = i === 0 ? 110 : 70;
    if (words > max) issues.push({ severity: "error", rule: "length", message: `Step ${i + 1} is ${words} words; keep it under ${max}.`, path: `sequence[${i}].body` });
    if (s.subject.split(/\s+/).length > 6) issues.push({ severity: "warn", rule: "subject", message: "Subject lines are 2-5 plain words.", path: `sequence[${i}].subject` });
    if (/[!$]|\bfree\b/i.test(s.subject)) issues.push({ severity: "error", rule: "subject", message: "No '!', '$' or 'free' in subject lines.", path: `sequence[${i}].subject` });
  });
  if (out.sequence[0] && !out.sequence[0].body.includes("{{firstLine}}")) issues.push({ severity: "error", rule: "personalisation", message: "Step 1 needs {{firstLine}} where the personal opener goes.", path: "sequence[0].body" });
  return issues;
}

function domainOf(url: string): string | null {
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Finds and evidences companies that need this business now (public web only). */
export function prospectingSpec(o: SpecOptions = {}): AgentSpec<ProspectsOutput> {
  return base(
    {
      id: "prospecting",
      role: "cso",
      label: "Find customers",
      skills: ["owner-brevity", "prospecting", "positioning"],
      schema: ProspectsOutputSchema,
      rubric: rubricOf("prospecting"),
      criticSkills: ["prospecting"],
      lint: lintProspects,
      maxTokens: { research: 32_000, draft: 32_000, critic: 12_000 },
    },
    o,
    "lean",
  );
}

function lintCreators(out: ProspectsOutput, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = lintCopy({ icp: out.icp.summary }, { evidence: evidenceOf(input) });
  if (out.prospects.length < 3) issues.push({ severity: "error", rule: "count", message: "Find at least 3 verified creators, or explain in excluded why the niche is thin.", path: "prospects" });
  const seen = new Set<string>();
  out.prospects.forEach((p, i) => {
    const path = `prospects[${i}]`;
    if (!/^https?:\/\//.test(p.website)) issues.push({ severity: "error", rule: "source", message: `${p.company}: needs their real profile URL.`, path: `${path}.website` });
    const key = p.website.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) issues.push({ severity: "error", rule: "duplicate", message: `${p.company} is listed twice.`, path });
    seen.add(key);
    if (!p.evidence.some((e) => /^https?:\/\//.test(e.url))) issues.push({ severity: "error", rule: "evidence", message: `${p.company}: cite the profile or a recent post.`, path: `${path}.evidence` });
    if (p.publicEmail && !p.evidence.some((e) => e.observation.toLowerCase().includes(p.publicEmail.toLowerCase()))) {
      issues.push({ severity: "error", rule: "invented_email", message: `${p.company}: only use an email copied verbatim from a cited page (quote it in evidence).`, path: `${path}.publicEmail` });
    }
    if (!/\d|unknown/i.test(p.sizeBand)) issues.push({ severity: "warn", rule: "audience", message: `${p.company}: state the audience as shown (e.g. "~12k Instagram followers") or "unknown".`, path: `${path}.sizeBand` });
  });
  return issues;
}

/** Finds real creators whose audience matches the buyers (public profiles only), with contact routes. */
export function creatorScoutSpec(o: SpecOptions = {}): AgentSpec<ProspectsOutput> {
  return base(
    {
      id: "creator_scout",
      role: "cmo",
      label: "Find creators",
      skills: ["owner-brevity", "creator-scouting", "positioning"],
      schema: ProspectsOutputSchema,
      rubric: rubricOf("creator-scouting"),
      criticSkills: ["creator-scouting"],
      lint: lintCreators,
      maxTokens: { research: 32_000, draft: 32_000, critic: 12_000 },
    },
    o,
    "lean",
  );
}

/** Writes the cold sequence and one sourced opener per prospect. */
export function outreachSpec(o: SpecOptions = {}): AgentSpec<OutreachOutput> {
  return base(
    {
      id: "cold_outreach",
      role: "cso",
      label: "Write the emails",
      skills: ["owner-brevity", "cold-outreach", "copy-fundamentals"],
      schema: OutreachOutputSchema,
      rubric: rubricOf("cold-outreach"),
      criticSkills: ["copy-fundamentals"],
      lint: lintOutreach,
      maxTokens: { research: 8_000, draft: 24_000, critic: 12_000 },
    },
    o,
    "lean",
  );
}

/** Research briefs per job (what the research phase should find). */
export function researchFor(task: TaskType | "business_insights" | "prospecting" | "creator_scout", ctx: { website?: string; businessName: string; country?: string }): ResearchSpec | undefined {
  const site = ctx.website ? ` (${ctx.website})` : "";
  switch (task) {
    case "growth_strategy":
      return {
        maxSearches: 7,
        maxFetches: 4,
        brief: `Find the specific, named places where ${ctx.businessName}${site}'s best-fit customers already gather or decide, so growth plays can name real audiences:
1. Communities, newsletters, podcasts, YouTube/TikTok creators, directories, marketplaces, review sites and app stores relevant to this business and its location (name, URL, rough size/audience if visible).
2. Complementary businesses or platforms that could partner (who already serves the same customer before or after this business).
3. Where competitors are present or absent (review sites, marketplaces, launches, local listings, comparison pages).
4. Seasonal or event windows in the next 90 days that matter to these customers.
Only report what you actually found, with URLs.`,
      };
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
    case "prospecting":
      // Searches are metered per plan; page reads (one per candidate's own site) are where verification happens.
      return {
        maxSearches: 12,
        maxFetches: 25,
        brief: `Find real companies that are a strong fit to buy from ${ctx.businessName}${site}${ctx.country ? ` (sells in ${ctx.country})` : ""}, from public web sources only.
1. Look for companies SHOWING THE NEED: e.g. their own site uses a weaker alternative or a manual workaround this business replaces, they are hiring for the job it does, they just launched or expanded, or they complain about the problem in public. Category + location searches, directories, marketplaces, association member lists, job boards and local news all work.
2. Skip competitors, and partners/resellers/certified agencies of a direct competitor (they are invested in the rival).
3. Gather about 1.5x the companies needed, then open EACH candidate's own website (one fetch each) to confirm it exists, what it does, where it is, and any published contact email (copy verbatim).
4. Note for each: name, website, location, size clues, a dated or observable trigger, the decision-maker role (a name only if on their own team page). Record the URL for every observation. Skip anything you can't verify.`,
      };
    case "creator_scout":
      return {
        maxSearches: 12,
        maxFetches: 25,
        brief: `Find real creators and influencers whose audience matches the buyers of ${ctx.businessName}${site}${ctx.country ? ` (sells in ${ctx.country})` : ""}, from public pages only.
1. Work out 3-5 audience niches from the positioning, then search the platforms that fit (Instagram, TikTok, YouTube, LinkedIn, X, newsletters, podcasts), creator lists and directories.
2. Open each candidate's profile or own site to confirm: handle, platform, audience size as shown publicly, location if stated, recent activity, and one recent post that shows fit (URL + what it's about).
3. Find the contact route: a business email published in bio/link-in-bio/site/media kit (copy verbatim), else the DM or form route. Never guess an email.
4. Skip inactive accounts, bought-looking audiences, off-niche creators and anyone promoting a direct competitor. Gather ~1.5x what's needed; record a URL for every observation.`,
      };
    case "conversion_audit":
      return { maxSearches: 2, maxFetches: 4, brief: `Fetch the business's money page(s) and 1-2 competitor equivalents. Note headline, offer, proof, CTA, objections handled and friction.` };
    default:
      return undefined;
  }
}

export type AnyAgentSpec = AgentSpec<unknown>;
