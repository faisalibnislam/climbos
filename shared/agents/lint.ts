import type { LintIssue } from "./types";

/**
 * Deterministic copy checks that run before the LLM critic (research:
 * docs/research/channel-content.md Part B). They catch AI tells, invented
 * numbers and platform-limit breaches cheaply and without judgment calls.
 */

// Hard-fail phrases. Matched case-insensitively on word boundaries.
export const BANNED_PHRASES: readonly string[] = [
  // Openers
  "in today's fast-paced world", "in today's digital age", "in an ever-evolving landscape", "let's dive in", "let's dive into", "buckle up",
  "are you ready to", "have you ever wondered", "picture this", "imagine a world", "here's the thing", "let that sink in",
  "i'm thrilled to announce", "i'm excited to announce", "i'm humbled to announce", "thrilled to announce", "excited to announce",
  // Hype
  "revolutionary", "game-changer", "game-changing", "game changer", "cutting-edge", "cutting edge", "state-of-the-art", "next-level", "world-class",
  "best-in-class", "seamless", "seamlessly", "innovative solution", "innovative solutions", "unleash", "unlock your potential", "supercharge",
  "skyrocket", "synergy", "holistic",
  // AI-signature vocabulary
  "delve", "tapestry", "testament to", "navigate the complexities", "multifaceted", "a myriad of", "plethora", "embark on",
  "in the world of", "bustling", "nestled",
  // Empty structures
  "look no further", "say goodbye to", "that's where", "the best part?", "the result?", "it's not about",
  // Closers
  "in conclusion", "at the end of the day", "don't miss out", "what are you waiting for", "the future is here", "join the revolution",
  "stay tuned", "drop a comment below", "smash that like button", "tag someone who", "tag a friend who", "comment yes",
  // Ad-policy risks
  "click here",
];

// Softer AI tells: flagged as warnings so the critic weighs them in context.
export const DISCOURAGED_WORDS: readonly string[] = [
  "elevate", "empower", "transform", "transformative", "harness", "leverage", "robust", "curated", "elevated", "realm", "pivotal",
  "paramount", "foster", "vibrant", "boasts", "intricate", "underscores", "journey", "landscape", "not just",
];

const SUPERLATIVES = /\b(best|#1|number one|leading|top-rated|fastest|cheapest|most trusted|no\.?\s?1)\b/i;

/**
 * Claim ledger (expansion slice 5; BK03 Ch 2 "your opinion isn't proof", BK02
 * Ch 10 "don't headline advantages you can't prove"): capability, scale and
 * leadership claims a buyer would rely on. Each needs matching, permitted
 * evidence; otherwise it's unsupported. `key` finds the claim in the evidence.
 */
const CLAIMS: { kind: string; re: RegExp; key: (m: RegExpMatchArray) => RegExp }[] = [
  { kind: "a speed or cost multiplier", re: /\b(\d+(?:\.\d+)?)\s?[x×]\s+(?:faster|quicker|cheaper|more|better|easier|less)\b/i, key: (m) => new RegExp(`\\b${m[1].replace(".", "\\.")}\\s?[x×]`, "i") },
  { kind: "round-the-clock availability", re: /\b24\/7\b|\bround[- ]the[- ]clock\b|\baround the clock\b/i, key: () => /\b24\/7\b|round[- ]the[- ]clock|around the clock/i },
  { kind: "market leadership", re: /\b(?:the )?(leading|#1|number one|no\.?\s?1|top-rated|best|most trusted|market[- ]leading)\s+(?:\w+\s+){0,2}(?:platform|tool|app|software|solution|service|agency|provider|company|choice|option)\b/i, key: (m) => new RegExp(`\\b${m[1].replace(/[#.]/g, "\\$&")}\\b`, "i") },
  { kind: "a user count", re: /\b(?:trusted|used|loved|chosen)\s+by\s+(thousands|millions|hundreds|\d[\d,.]*\s*(?:k|\+)?)/i, key: (m) => new RegExp(m[1].replace(/[.+]/g, "\\$&"), "i") },
  { kind: "an award or certification", re: /\baward[- ]winning\b|\b(?:soc ?2|iso ?27001|hipaa|gdpr)[- ]?(?:compliant|certified)\b|\bcertified\b/i, key: (m) => new RegExp(m[0].split(/[\s-]/)[0], "i") },
  { kind: "full automation", re: /\bfully[- ]automat\w+\b|\bhands[- ]free\b|\bno human\b/i, key: () => /fully[- ]automat|hands[- ]free|no human|automat/i },
  // Spec §9: reference prices, ratings and fee or cancellation promises are buyer-relied claims.
  { kind: "a reference or former price", re: /\b(?:was|regularly|normally|usually|originally|compare at|valued at|worth|retail(?:s)? (?:at|for))\s+[$£€]\s?(\d[\d,.]*)/i, key: (m) => new RegExp(`[$£€]\\s?${m[1].replace(/[.,]/g, "[.,]?")}`, "i") },
  { kind: "a star rating", re: /\b(\d(?:\.\d)?)\s?(?:\/\s?5\s?)?(?:stars?|-star)\s+(?:rating|rated|average|on google|reviews?)\b|\brated\s+(\d(?:\.\d)?)\s?(?:\/\s?5|stars?|out of 5)/i, key: (m) => new RegExp(`\\b${(m[1] ?? m[2]).replace(".", "\\.")}\\b`) },
  { kind: "a no-hidden-fees promise", re: /\bno hidden (?:fees|charges|costs)\b|\bno (?:extra|surprise|additional) (?:fees|charges)\b/i, key: () => /hidden|all[- ]in|total price|no (?:extra|surprise|additional) (?:fees|charges)|fees? included/i },
  { kind: "a cancel-anytime promise", re: /\bcancel (?:any ?time|whenever)\b|\bno (?:contract|commitment|lock-?in)\b/i, key: () => /cancel|contract|commitment|lock-?in/i },
];

/** A free trial must say what happens when it ends (spec §9 disclosure). */
const TRIAL_OFFER = /\bfree trial\b|\btry (?:it |us )?(?:for )?free for\b|\b\d+[- ]day trial\b/i;
const TRIAL_TERMS = /\b(?:then|after (?:the|your) (?:\d+[- ]day )?trial|auto-?renew\w*|renews?|cancel (?:any ?time|before|during)|billed|charged|no (?:credit )?card|ends automatically|won't be charged)\b/i;

/** Availability and deadline claims must be grounded in a confirmed current offer. */
const SCARCITY_CLAIM = /\b(?:only\s+\d[\d,.]*\s+(?:spots?|seats?|places?|tickets?|items?|rooms?|appointments?|openings?)\s+(?:left|remain(?:ing)?|available)|last\s+(?:few|\d+[\d,.]*|remaining)\s+(?:spots?|seats?|places?|tickets?|items?|rooms?|appointments?|openings?)|limited[- ](?:time|availability|quantity|stock|seats?|spots?|places?|tickets?)|while\s+(?:supplies|stocks?)\s+last|almost\s+sold\s+out|last\s+chance)\b/i;
const DEADLINE_CLAIM = /\b(?:offer|sale|discount|price|registration|enrollment|booking|application)\s+(?:ends?|expires?|closes?)\s+(?:today|tonight|tomorrow|on\s+[\p{L}\d, -]{3,30}|in\s+\d+\s+(?:hours?|days?|weeks?)|at\s+midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\b(?:ends?|expires?|closes?)\s+(?:today|tonight|tomorrow|on\s+[\p{L}\d, -]{3,30}|in\s+\d+\s+(?:hours?|days?|weeks?)|at\s+midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/iu;
const SCARCITY_EVIDENCE = /\b(?:limited|only\s+\d|\d[\d,.]*\s+(?:spots?|seats?|places?|tickets?|items?|rooms?|appointments?|openings?)\s+(?:left|remain(?:ing)?|available)|last\s+(?:few|\d+|remaining)|while\s+(?:supplies|stocks?)\s+last|almost\s+sold\s+out|last\s+chance)\b/i;
const DEADLINE_EVIDENCE = /\b(?:ends?|expires?|closes?|deadline|through|until|by\s+(?:today|tonight|tomorrow|\w+\s+\d{1,2}|\d{1,2}\s+\w+)|today|tonight|tomorrow|midnight)\b/i;

/** Named integrations create concrete buyer expectations and are easy to overstate. */
const NAMED_INTEGRATION = /\b(?:[Ii]ntegrat\w*\s+with|[Cc]onnects?\s+(?:directly\s+)?to|[Cc]onnects?\s+with|[Ss]yncs?\s+with)\s+([A-Z][\w.+-]*(?:\s+[A-Z][\w.+-]*){0,2}|CRM|API)\b/g;
const INTEGRATION_EVIDENCE = /\b(?:integrat\w*|connect\w*|sync\w*)\b/i;
const NON_AFFIRMATIVE_EVIDENCE = /\b(?:no|not|isn't|aren't|doesn't|does not|never|no longer|without|lack(?:s|ing)?|unavailable|not yet|request(?:ed|ing)?|ask(?:ed|ing)? for|want(?:s|ed)?|would|could|might|may|plan(?:s|ned)? to|hope to)\b/i;

/** Sentence boundaries; a period inside a number ("4.9") does not end a sentence. */
const SENTENCE_BREAK = /[\n!?;]+|\.(?=\s|$)/;

function supportedByAffirmativeEvidence(pattern: RegExp, evidence: string): boolean {
  return evidence.split(SENTENCE_BREAK).some((sentence) => pattern.test(sentence) && !NON_AFFIRMATIVE_EVIDENCE.test(sentence));
}

function hasIntegrationEvidence(service: string, evidence: string): boolean {
  return evidence.split(SENTENCE_BREAK).some((sentence) => sentence.toLocaleLowerCase("en-US").includes(service.toLocaleLowerCase("en-US")) && INTEGRATION_EVIDENCE.test(sentence) && !NON_AFFIRMATIVE_EVIDENCE.test(sentence));
}

function supportsUrgencyClaim(claim: string, evidence: string, kind: "scarcity" | "deadline"): boolean {
  const numbers = (value: string) => (value.match(/\b\d[\d,.]*\b/g) ?? []).map((item) => item.replace(/[,.]/g, ""));
  const number = numbers(claim)[0];
  const claimEvidence = kind === "scarcity" ? SCARCITY_EVIDENCE : DEADLINE_EVIDENCE;
  return evidence.split(SENTENCE_BREAK).some((sentence) => {
    return claimEvidence.test(sentence) && !NON_AFFIRMATIVE_EVIDENCE.test(sentence) && (!number || numbers(sentence).includes(number));
  });
}

/**
 * Platform-manipulation patterns no evidence can make acceptable: asking for
 * votes, paying or rewarding reviews, inviting only satisfied customers to
 * review, and promising virality (spec section 11 platform rules).
 */
const MANIPULATION: { rule: string; re: RegExp; message: string }[] = [
  { rule: "vote_request", re: /\b(?:up-?vote|vote for us|vote us up|give us (?:an? )?(?:upvote|vote)|support us (?:on|with a vote on) product hunt|help us (?:reach|hit|get to) #?1 on product hunt)\b/i, message: "Asks people for votes. Launch and community platforms treat vote requests as manipulation; ask for honest feedback instead." },
  { rule: "review_incentive", re: /\b(?:(?:leave|write|post)\s+(?:us\s+)?an?\s+(?:\d-star\s+|five-star\s+|5-star\s+|positive\s+|good\s+|great\s+)?review\b[^.!?\n]{0,60}\b(?:get|receive|earn|win|for)\s+(?:an?\s+|\d+%?\s+)?(?:free|discount|gift|voucher|coupon|credit|entry|off|reward|\$)|(?:free|discount|gift|voucher|coupon|reward)\w*(?:\s+\w+){0,3}\s+(?:for|in exchange for)\s+(?:an?\s+|your\s+)?(?:\d-star\s+|five-star\s+|5-star\s+|positive\s+)?reviews?)/i, message: "Offers something in return for a review. Incentivised reviews break most review platforms' rules; ask every customer the same neutral way." },
  { rule: "review_gating", re: /\b(?:if you (?:loved|enjoyed|liked|had a (?:great|good|positive|wonderful) (?:experience|time))[^.!?\n]{0,40}\breview|(?:happy|satisfied) customers?[^.!?\n]{0,30}\b(?:leave|write|post) (?:us )?an? review|only (?:happy|satisfied) customers|(?:5|five)-star reviews? (?:only|please)|leave (?:us )?an? (?:5|five)-star review)/i, message: "Invites only satisfied customers or a set rating. Review platforms ban this gating; invite every customer with the same neutral wording." },
  { rule: "virality_promise", re: /\b(?:guaranteed? (?:to )?(?:go )?viral|will go viral|go viral guaranteed|guaranteed (?:views|followers|likes))\b/i, message: "Promises virality or guaranteed reach. No one controls platform distribution; describe the content, not the outcome." },
];

export function lintManipulation(fields: { path: string; text: string }[]): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const { path, text } of fields) {
    for (const m of MANIPULATION) if (m.re.test(text)) issues.push({ severity: "error", rule: m.rule, message: m.message, path });
  }
  return issues;
}

/** Unsupported capability, scale or leadership claims in customer-facing text. */
export function lintClaims(fields: { path: string; text: string }[], evidence: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const { path, text } of fields) {
    for (const m of text.matchAll(NAMED_INTEGRATION)) {
      if (!hasIntegrationEvidence(m[1], evidence)) {
        issues.push({ severity: "error", rule: "unsupported_capability", message: `The integration with "${m[1]}" has no matching verified capability fact. Remove the promise or confirm the integration first.`, path });
        break;
      }
    }
    for (const c of CLAIMS) {
      const m = text.match(c.re);
      if (m && !supportedByAffirmativeEvidence(c.key(m), evidence)) {
        issues.push({ severity: "error", rule: "unsupported_claim", message: `"${m[0]}" is ${c.kind} no verified capability evidence supports. Say what the product verifiably does, or drop it.`, path });
        break;
      }
    }
    const scarcity = text.match(SCARCITY_CLAIM);
    if (scarcity && !supportsUrgencyClaim(scarcity[0], evidence, "scarcity")) {
      issues.push({ severity: "error", rule: "unsupported_scarcity", message: "Scarcity or inventory claims need current confirmed availability evidence, including the same quantity when one is stated. Remove the urgency or confirm the real limit first.", path });
    }
    const deadline = text.match(DEADLINE_CLAIM);
    if (deadline && !supportsUrgencyClaim(deadline[0], evidence, "deadline")) {
      issues.push({ severity: "error", rule: "unsupported_deadline", message: "A deadline or expiring offer needs a current confirmed end date or time. Remove the deadline or confirm the real terms first.", path });
    }
  }
  for (const { path, text } of fields) {
    if (TRIAL_OFFER.test(text) && !TRIAL_TERMS.test(text)) issues.push({ severity: "error", rule: "trial_terms", message: "A free trial needs to say what happens when it ends (the price it renews at, or that it ends without a charge) in the same copy.", path });
  }
  return [...issues, ...lintManipulation(fields)];
}
const EMOJI = /\p{Extended_Pictographic}/gu;

export interface StringField {
  path: string;
  text: string;
}

/** Walk every string in a JSON value with its path (e.g. "posts[1].body"). */
export function stringFields(value: unknown, path = ""): StringField[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => stringFields(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => stringFields(v, path ? `${path}.${k}` : k));
  }
  return [];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const bannedRes = BANNED_PHRASES.map((p) => ({ p, re: new RegExp(`(^|[^\\p{L}])${escapeRe(p)}(?=$|[^\\p{L}])`, "iu") }));
const discouragedRes = DISCOURAGED_WORDS.map((p) => ({ p, re: new RegExp(`(^|[^\\p{L}])${escapeRe(p)}(?=$|[^\\p{L}])`, "iu") }));

export interface CopyLintOptions {
  /** Phrases the brand genuinely uses (owner's voice), exempt from the banned list. */
  allow?: string[];
  /** Field paths to skip (e.g. URLs, hashtags arrays checked separately, ids). */
  skip?: (path: string) => boolean;
  /** Text the numbers in the output must trace back to (facts, brief, research). */
  evidence?: string;
  /** Evidence allowed to substantiate customer-facing product and performance claims. */
  claimEvidence?: string;
  maxExclamations?: number;
  /** Max emoji per 150 characters (0 = no emoji). */
  emojiPer150?: number;
  /** Publishable copy: a [NEEDS FACT] placeholder is an error, not a warning. */
  publishable?: boolean;
  /** Plans: a number in a sentence labelled as an assumption, target, estimate or rule is not a factual claim. */
  labelled?: boolean;
}

/** Words that mark a number as the planner's own assumption, forecast or decision rule. */
const LABELLED = /\b(assum\w*|estimat\w*|targets?|goals?|aim\w*|forecast\w*|project(?:ed|ions?)|expect\w*|cap(?:ped)?|budget\w*|up to|at most|at least|max(?:imum)?|min(?:imum)?|kill|scale|stop|threshold\w*|limit\w*)\b/i;

/** Numbers in the output that don't appear anywhere in the evidence. */
export function untracedNumbers(text: string, evidence: string, opts: { labelled?: boolean } = {}): string[] {
  const normalize = (s: string) => s.replace(/[,\s]/g, "");
  const ev = normalize(evidence);
  const found: string[] = [];
  // Labelled plans: drop sentences that say the number is an assumption, target or rule.
  // Deadlines ("by day 21", "45 days", "week 6") are plan decisions, not claims.
  const checked = opts.labelled
    ? text
        .split(/(?<=[.;!?])\s+|\n+/)
        .filter((c) => !LABELLED.test(c))
        .join("\n")
        .replace(/\b(?:days?|weeks?|months?)\s+\d+\b|\b\d+(?:\s*[-–]\s*\d+)?\s*(?:days?|weeks?|months?)\b/gi, " ")
    : text;
  // Units count only as whole tokens: "10k", "3x", "40%" — not the "m" of "1 month".
  for (const m of checked.matchAll(/[$£€]?\d[\d,.]*(?:\s?%|(?:k|m|x)(?![a-z])|×)?/gi)) {
    const raw = m[0].trim();
    const digits = normalize(raw).replace(/[$£€%kmx×]/gi, "").replace(/\.$/, "");
    if (!digits) continue;
    const n = Number(digits);
    // Small bare counts ("3 tips", "Step 2") and years are not factual claims on their own.
    const hasUnit = /[$£€%×]|\d(k|m|x)$/i.test(raw);
    if (!hasUnit && Number.isFinite(n) && (n <= 12 || (n >= 1990 && n <= 2035))) continue;
    if (!ev.includes(digits)) found.push(raw);
  }
  return [...new Set(found)];
}

export function lintCopy(output: unknown, opts: CopyLintOptions = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  const allow = new Set((opts.allow ?? []).map((a) => a.toLowerCase()));
  const maxExcl = opts.maxExclamations ?? 1;
  let exclamations = 0;
  for (const { path, text } of stringFields(output)) {
    if (opts.skip?.(path) || /^https?:\/\//.test(text.trim())) continue;
    for (const { p, re } of bannedRes) {
      if (!allow.has(p) && re.test(text)) issues.push({ severity: "error", rule: "banned_phrase", message: `Uses the AI-cliché "${p}". Rewrite it with something specific.`, path });
    }
    for (const { p, re } of discouragedRes) {
      if (!allow.has(p) && re.test(text)) issues.push({ severity: "warn", rule: "discouraged_word", message: `"${p}" reads like AI copy; prefer a concrete word.`, path });
    }
    exclamations += (text.match(/!/g) ?? []).length;
    if (/!!|\?\?|\?!/.test(text)) issues.push({ severity: "error", rule: "punctuation", message: "Repeated punctuation.", path });
    if (/\b[A-Z]{4,}\b/.test(text.replace(/\b(USA|UK|EU|SEO|CRM|SaaS|API|HTML|PDF|URL|FAQ|ROI|CEO|CTA|DIY|HVAC|NEEDS FACT|LLC|GDPR|B2B|B2C|DTC|SMS|USD|GBP|EUR)\b/g, ""))) {
      issues.push({ severity: "warn", rule: "all_caps", message: "ALL-CAPS words read as shouting and can fail ad review.", path });
    }
    if (opts.emojiPer150 !== undefined) {
      const emoji = (text.match(EMOJI) ?? []).length;
      const allowed = opts.emojiPer150 === 0 ? 0 : Math.max(1, Math.floor((text.length / 150) * opts.emojiPer150));
      if (emoji > allowed) issues.push({ severity: "error", rule: "emoji", message: `${emoji} emoji; at most ${allowed} here.`, path });
    }
    if (SUPERLATIVES.test(text) && !(opts.evidence && SUPERLATIVES.test(opts.evidence))) {
      issues.push({ severity: "warn", rule: "superlative", message: "Superlative claim (best, #1, leading…) needs a cited source or should go.", path });
    }
    if (/\[\s*\d+\s*\]/.test(text)) issues.push({ severity: "error", rule: "fact_marker", message: "Contains a [n] fact marker in reader-facing text.", path });
    if (opts.publishable && (opts.claimEvidence !== undefined || opts.evidence !== undefined)) {
      issues.push(...lintClaims([{ path, text }], opts.claimEvidence ?? opts.evidence ?? ""));
    }
    if (opts.evidence !== undefined) {
      const untraced = untracedNumbers(text, opts.evidence, { labelled: opts.labelled });
      if (untraced.length)
        issues.push({
          severity: "error",
          rule: "invented_fact",
          message: opts.labelled
            ? `Numbers not found in the inputs, facts or research: ${untraced.join(", ")}. Cite where each comes from, use a number from the inputs, or say it is an assumption, target or estimate.`
            : `Numbers not found in the facts or research: ${untraced.join(", ")}. Remove them or rephrase without the number.`,
          path,
        });
    }
    if (/\[NEEDS FACT|\[(insert|placeholder|your |add )/i.test(text)) {
      issues.push(
        opts.publishable
          ? { severity: "error", rule: "placeholder", message: "Publishable copy can't contain placeholders. Use an angle the confirmed facts fully support.", path }
          : { severity: "warn", rule: "needs_fact", message: "Has a [NEEDS FACT] gap the owner must fill.", path },
      );
    }
  }
  if (exclamations > maxExcl) issues.push({ severity: "warn", rule: "exclamations", message: `${exclamations} exclamation marks; keep it to ${maxExcl}.` });
  return issues;
}

export function maxLength(text: string | undefined, max: number, path: string, label = "Text"): LintIssue[] {
  if (!text) return [];
  const len = [...text].length;
  return len > max ? [{ severity: "error", rule: "length", message: `${label} is ${len} characters; the limit is ${max}.`, path }] : [];
}

export function maxItems(items: unknown[] | undefined, max: number, path: string, label: string): LintIssue[] {
  return items && items.length > max ? [{ severity: "error", rule: "count", message: `${items.length} ${label}; at most ${max}.`, path }] : [];
}

export function minItems(items: unknown[] | undefined, min: number, path: string, label: string): LintIssue[] {
  return !items || items.length < min ? [{ severity: "error", rule: "count", message: `Needs at least ${min} ${label}.`, path }] : [];
}

/** Hook check: the text before the platform's "see more" fold must carry the hook. */
export function hookBeforeFold(text: string | undefined, fold: number, path: string): LintIssue[] {
  if (!text) return [];
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
  return [...firstLine].length > fold
    ? [{ severity: "warn", rule: "fold", message: `The opening line runs past the ~${fold}-character fold; put the hook first and keep it short.`, path }]
    : [];
}
