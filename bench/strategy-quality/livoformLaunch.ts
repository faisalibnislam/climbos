import { z } from "zod";
import type { AgentInput } from "../../shared/agents/types";
import { focusedPlanTask } from "../../shared/agents/focusedPlan";
import { campaignTimingTask } from "../../shared/agents/planTasks";
import { localToday } from "../../shared/agents/campaignTiming";
import { LIVOFORM_PUBLIC_DOCS, livoformPublicDocsResearch } from "./livoformPublicDocs";

const LaunchEvidencePackSchema = z.enum(["original", "public-docs-20261118"]);
export type LaunchEvidencePack = z.infer<typeof LaunchEvidencePackSchema>;

/** Explicit opt-in: other stages must not silently ignore evidence selection. */
export function parseLaunchEvidencePack(stage: string, value?: string): LaunchEvidencePack {
  if (value !== undefined && stage !== "launch-acceptance") throw new Error("Launch evidence selection is only accepted by the launch-acceptance stage.");
  return LaunchEvidencePackSchema.parse(value ?? "original");
}

/** Owner reports stay in an ignored local input file, never embedded in the tracked case. */
export const LaunchOwnerContextSchema = z.object({
  website: z.literal("https://livoform.com/"),
  reportedAt: z.iso.date(),
  statements: z.array(z.string().trim().min(1).max(1500)).min(1).max(10),
}).strict();

export const LIVOFORM_LAUNCH_SOURCES = [
  { url: "https://livoform.com/", title: "Livoform homepage — read 2026-11-17; publication date unknown" },
  { url: "https://livoform.com/pricing", title: "Livoform pricing — read 2026-11-17; publication date unknown, web result may be cached" },
];

// Concise paraphrases of the inspected pages, kept apart from owner reports.
const RESEARCH = `Public first-party pages inspected on 2026-11-17. Website statements are source-reported feature/price claims, not tested product behavior or customer evidence. Publication/update dates are unknown; the pricing web result reported a prior-week crawl.
https://livoform.com/: The product is presented as an AI form builder with conditional logic and response workflows. The page advertises unlimited free forms/responses, limited free AI creation, and assistant/API access. It links agencies, sales, education and other use cases; listing them does not prove customer demand. It says Core provides connections/payments, Pro adds AI processing, and Business adds team controls. The visible example analytics panel is demonstration content, not business traffic, signups or revenue. The owner reports override any inference from those examples. Competitor comparison claims on this page are not independently checked.
https://livoform.com/pricing: Free is described as having no card requirement or trial expiry. Core and Pro are company-wide; Business is per seat. Monthly list prices are USD 2, 6 and 19 respectively. Annual totals shown are USD 20 per company, 60 per company and 190 per seat; displayed monthly equivalents are annual billing, not monthly charges. Tax may be added at checkout. Core advertises custom domains, removal of product branding, integrations and Stripe payments. Pro adds document/brief form creation and bounded AI response work. Business adds publishing approval, audit and retention controls. Feature and price claims still need product/checkout confirmation before publication. No costs or margins are supplied.
The homepage links https://livoform.com/use-cases/agencies, https://livoform.com/templates and https://livoform.com/integrations/chatgpt-claude. Retrieval failed for these three URLs; their contents are NOT inspected and they are not available source citations. Their existence as links does not prove an asset's content or functionality. No community rules, creator audience, platform eligibility or competing vendor terms were checked.`;

export const LIVOFORM_LAUNCH_QUESTIONS = [
  "Does the strategy use the dated owner reports without inventing a measured period, existing audience, conversion rate or retention problem?",
  "Does it choose a specific initial customer job and distribution mechanism as a hypothesis, with a useful fallback when no contacts, list or audience are available?",
  "Does it explain why that customer might pay beyond Free, keeping monthly versus annual billing, company versus seat pricing, costs and unknown willingness to pay distinct?",
  "Does it prepare usable work for one small acquisition-and-activation test with qualified outcomes and honest uncertainty, rather than only requesting analytics or listing platforms?",
  "Are grounded, adjacent and bold mechanisms genuinely distinct, business-relevant and testable without requiring a matching precedent?",
  "Does it preserve draft/approval boundaries and leave community rules, uninspected pages, real product behavior and unknown operating capacity unverified?",
];

// Required keys prevent a reviewer from silently omitting a held-out question or paraphrasing its identity.
const LaunchQuestionAnswer = z.object({ A: z.number().min(1).max(5), B: z.number().min(1).max(5), evidence: z.string().min(1) });
export const LaunchComparisonResponseSchema = z.object({
  verdict: z.enum(["A", "B", "tie", "neither"]),
  questions: z.object(Object.fromEntries(LIVOFORM_LAUNCH_QUESTIONS.map((question, index) => [`q${index + 1}`, LaunchQuestionAnswer.describe(question)]))).strict(),
  criticalErrors: z.array(z.object({ version: z.enum(["A", "B"]), claim: z.string(), reason: z.string() })),
  usefulNextStep: z.object({ A: z.boolean(), B: z.boolean(), reason: z.string() }),
  improvements: z.array(z.string()), summary: z.string(),
});

/** Preserve every supplied score and verbatim question without asking the model to retype identifiers. */
export function normalizeLaunchComparison(value: unknown) {
  const parsed = LaunchComparisonResponseSchema.parse(value);
  return { ...parsed, questions: LIVOFORM_LAUNCH_QUESTIONS.map((question, index) => ({ question, ...parsed.questions[`q${index + 1}`] })) };
}

export function livoformLaunchInput(ownerInput: unknown, now = Date.now(), evidencePack: LaunchEvidencePack = "original"): AgentInput {
  const owner = LaunchOwnerContextSchema.parse(ownerInput);
  LaunchEvidencePackSchema.parse(evidencePack);
  const enriched = evidencePack === "public-docs-20261118";
  const sources = enriched ? [...LIVOFORM_LAUNCH_SOURCES, ...LIVOFORM_PUBLIC_DOCS.map(source => ({ url: source.url, title: `${source.title} — retrieved ${source.retrievedAt}; updated ${source.updatedAt ?? "unknown"}` }))] : LIVOFORM_LAUNCH_SOURCES;
  // The original frozen pack stays byte-identical. The new pack retains each page's own date.
  const research = enriched
    ? `${RESEARCH.slice(0, RESEARCH.indexOf("\nThe homepage links "))}\nAdditional first-party documentation inspected on 2026-11-18, evidence pack public-docs-20261118. The homepage/pricing claims above retain their November 17 retrieval basis. The earlier failed read of /integrations/chatgpt-claude is superseded by the successful dated read below. The linked /use-cases/agencies and /templates pages remain uninspected and unavailable for citation. No community rules, creator audience, platform eligibility or competing vendor terms were checked. No product or payment behavior was tested.\n\n${livoformPublicDocsResearch()}`
    : RESEARCH;
  const facts = owner.statements.map(statement => `Owner reports (${owner.reportedAt}): ${statement}`);
  const timingContext = { today: localToday("UTC", now), timezone: "UTC", now };
  const brief = "OWNER-SELECTED PUBLIC-SOURCE ACCEPTANCE CASE: Livoform, https://livoform.com/. Use the separately supplied dated owner reports to establish its launch situation. Proposed evaluation objective: find a narrow initial customer job, first qualified users, a meaningful activation event and evidence of willingness to pay. This objective and a 14-day initial test are evaluation choices, not an owner revenue target or deadline. Do not infer that free users, contacts or an audience exist or do not exist. Costs, margins, support capacity, owner time, geography and actual marketing budget remain unknown. A zero paid-media allocation is a constraint of this evaluation, not a statement of the real business budget. No external action is authorized. Build toward a conditional longer-term direction without invented forecasts.";
  return {
    task: `${focusedPlanTask(14)}\n${campaignTimingTask(timingContext)}\nUTC is this evaluation clock only, not evidence of customer location or business timezone. Use not_relevant for an evergreen first-user test. Owner reports are not measured analytics or billing evidence; do not invent a reporting interval.`,
    brief,
    facts: facts,
    // Match production's business-summary query rather than the evaluator's instructions.
    // These are only capabilities already present in RESEARCH, not new evidence or a proposed strategy.
    creativeRetrievalQuery: "AI form builder with conditional logic and response workflows; assistant/API access; company-wide Core/Pro subscriptions; custom domains and product branding removal (source-reported, not tested).",
    businessWebsite: "https://livoform.com/",
    ownerSuppliedUrls: ["https://livoform.com/"],
    timingContext,
    precomputedResearch: { notes: research, sources },
    availableSourceUrls: sources.map(source => source.url),
    constraints: { currency: "USD", horizonDays: 14, monthlyAdBudgetUsd: 0, businessTypes: ["b2b_saas"], factEvidenceBases: facts.map(() => "owner_reported" as const), factKinds: facts.map(() => "owner" as const) },
  };
}


/** Compare output quality on identical business evidence, without exposing either review to the judge. */
export function livoformLaunchComparison(a: { caseId: string; schemaPassed?: boolean; input: AgentInput; result?: { output?: unknown } }, b: { caseId: string; schemaPassed?: boolean; input: AgentInput; result?: { output?: unknown } }) {
  for (const record of [a, b]) {
    if (record.caseId !== "livoform" || !record.schemaPassed || !record.result?.output || record.input.businessWebsite !== "https://livoform.com/" || !record.input.brief.startsWith("OWNER-SELECTED PUBLIC-SOURCE ACCEPTANCE CASE:")) throw new Error("Launch comparison requires two complete owner-selected launch records.");
  }
  const evidence = (input: AgentInput) => ({ brief: input.brief, facts: input.facts, research: input.precomputedResearch, constraints: input.constraints, businessWebsite: input.businessWebsite, ownerSuppliedUrls: input.ownerSuppliedUrls });
  if (JSON.stringify(evidence(a.input)) !== JSON.stringify(evidence(b.input))) throw new Error("Launch comparison requires identical business evidence; do not mix different owner reports or source packs.");
  return { ...evidence(a.input), questions: LIVOFORM_LAUNCH_QUESTIONS, A: a.result!.output, B: b.result!.output };
}
