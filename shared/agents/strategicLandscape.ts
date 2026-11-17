import { z } from "zod";
import type { LintIssue } from "./types";

export const COMPETITIVE_FORCES = ["rivalry", "buyer_power", "supplier_power", "new_entrants", "substitutes"] as const;
export const MACRO_FACTORS = ["political", "economic", "social", "technological", "legal", "environmental"] as const;
export const PRESSURE_LABELS: Record<string, string> = {
  rivalry: "Competition for the same customers", buyer_power: "Customers' negotiating power", supplier_power: "Dependence on suppliers and platforms", new_entrants: "New competitors entering", substitutes: "Other ways customers solve the problem",
  political: "Political conditions", economic: "Economic conditions", social: "Customer and social changes", technological: "Technology changes", legal: "Legal conditions", environmental: "Environmental conditions",
};
const explanation = z.string().trim().min(8).max(300);
const response = z.object({
  basis: z.enum(["evidence_supported_inference", "speculative_hypothesis"]),
  signalIndexes: z.array(z.number().int().min(0).max(7)).max(4),
  mechanism: explanation,
  businessImplication: explanation,
  possibleResponse: explanation,
  tradeoff: explanation,
  nextCheck: explanation,
});
export const StrategicLandscapeSchema = z.object({
  market: z.string().trim().min(2).max(180).nullable(),
  customerSegment: z.string().trim().min(2).max(180).nullable(),
  geography: z.string().trim().min(2).max(180).nullable(),
  scopeBasis: z.enum(["owner_report", "measured", "research", "site_claim", "inference"]),
  scopeEvidenceRefs: z.array(z.string()).max(4),
  scopeLimitation: explanation,
  forces: z.array(response.extend({ force: z.enum(COMPETITIVE_FORCES), pressure: z.enum(["low", "medium", "high", "unknown"]) })).max(5),
  unassessedForces: z.array(z.enum(COMPETITIVE_FORCES)).max(5),
  macroFactors: z.array(response.extend({ factor: z.enum(MACRO_FACTORS), direction: z.enum(["headwind", "tailwind", "mixed", "unknown"]) })).max(6),
  unassessedMacroFactors: z.array(z.enum(MACRO_FACTORS)).max(6),
  /** A short decision shortlist, not a score or a ranking of the creative options. */
  priorityRefs: z.array(z.string().regex(/^(force|macro):[a-z_]+$/)).max(3),
  decisionSummary: explanation,
});
export type StrategicLandscape = z.infer<typeof StrategicLandscapeSchema>;
export type LandscapeResponse = StrategicLandscape["forces"][number] | StrategicLandscape["macroFactors"][number];

export const STRATEGIC_LANDSCAPE_TASK = `STRATEGIC LANDSCAPE: Use strategicLandscape to connect competitive structure and external change to this business's next decision. Define the market, customer segment and served geography only as supported; null is unknown. scopeBasis and scopeEvidenceRefs describe the sources for that definition, and scopeLimitation preserves uncertainty. Never infer location from currency, timezone, domain suffix or search rankings.
For Five Forces, consider rivalry for the same customers, buyer negotiating power, supplier/platform dependence, barriers and likely new entrants, and substitutes including manual work or doing nothing. A substitute solves the same need differently; a competitor count alone does not establish pressure. For PESTLE, consider political, economic, social, technological, legal and environmental changes only where a specific mechanism affects this business. Do not fill boxes with generic trends.
Reuse the existing marketSignals: signalIndexes are their zero-based positions, with their original references, dates, source labels and limitations. Every evidence_supported_inference needs at least one cited non-inference signal; use speculative_hypothesis for unsupported possibilities. Neither classification proves the causal mechanism. Each included force/factor must explain mechanism, businessImplication, possibleResponse, tradeoff and nextCheck (a small reversible check that could change the decision). The pressure/direction is a labeled judgment, not a measured score. For legal or political claims use current relevant primary sources and jurisdiction; uncertain applicability is a question to verify, never a legal conclusion. Do not invent dates, demand, costs, capacity or performance thresholds.
Place each of the five forces and six macro factors exactly once, either in its findings list or its unassessed list. Unassessed means not established, never low risk or no effect. Empty findings and all-unassessed are valid when evidence is insufficient. Select up to three priorityRefs in force:key or macro:key form and explain their effect on the persist/adjust/pivot-test decision in decisionSummary. A priority must refer to a finding, never an unassessed area. No composite score. This is decision context, not permission to execute, and it must not remove or down-rank a bold alternative solely for uncertainty or lack of precedent.`;

export function emptyStrategicLandscape(): StrategicLandscape {
  return { market: null, customerSegment: null, geography: null, scopeBasis: "inference", scopeEvidenceRefs: [], scopeLimitation: "The market, customer segment and served geography have not been established.", forces: [], unassessedForces: [...COMPETITIVE_FORCES], macroFactors: [], unassessedMacroFactors: [...MACRO_FACTORS], priorityRefs: [], decisionSummary: "Collect business-specific evidence before drawing conclusions about competitive or external pressures." };
}

export function lintStrategicLandscape(landscape: StrategicLandscape, signals: readonly { basis: string; evidenceRefs: string[] }[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const error = (path: string, message: string) => issues.push({ severity: "error", rule: "strategic_landscape", path: `strategicLandscape.${path}`, message });
  const coverage = (all: readonly string[], included: string[], unassessed: string[], path: string) => {
    const seen = [...included, ...unassessed];
    if (seen.length !== all.length || new Set(seen).size !== all.length || all.some(key => !seen.includes(key))) error(path, "Represent every dimension once as a finding or explicitly unassessed; do not omit or double-count a pressure.");
  };
  coverage(COMPETITIVE_FORCES, landscape.forces.map(row => row.force), landscape.unassessedForces, "forces");
  coverage(MACRO_FACTORS, landscape.macroFactors.map(row => row.factor), landscape.unassessedMacroFactors, "macroFactors");
  const check = (row: LandscapeResponse, path: string) => {
    if (new Set(row.signalIndexes).size !== row.signalIndexes.length || row.signalIndexes.some(index => !signals[index])) error(`${path}.signalIndexes`, "Link only distinct market signals present in this report.");
    if (row.basis === "evidence_supported_inference" && !row.signalIndexes.some(index => signals[index]?.basis !== "inference" && Boolean(signals[index]?.evidenceRefs.length))) error(`${path}.basis`, "An evidence-supported interpretation needs a cited non-inference market signal. Otherwise label it speculative and name the check needed.");
  };
  landscape.forces.forEach((row, i) => check(row, `forces[${i}]`));
  landscape.macroFactors.forEach((row, i) => check(row, `macroFactors[${i}]`));
  const keys = [...landscape.forces.map(row => `force:${row.force}`), ...landscape.macroFactors.map(row => `macro:${row.factor}`)];
  if (keys.length && !landscape.priorityRefs.length) error("priorityRefs", "Choose at least one material finding for the next decision, or leave unassessed areas out of the findings lists.");
  if (new Set(landscape.priorityRefs).size !== landscape.priorityRefs.length || landscape.priorityRefs.some(ref => !keys.includes(ref))) error("priorityRefs", "Choose distinct included findings for the decision shortlist; unassessed dimensions cannot become established priorities.");
  return issues;
}

/** Whole priority records only; no arithmetic, action authority or creative-option ranking. */
export function strategicLandscapeContext(value?: StrategicLandscape): string {
  if (!value) return "";
  const priorities = value.priorityRefs.flatMap(ref => {
    const row = ref.startsWith("force:") ? value.forces.find(row => `force:${row.force}` === ref) : value.macroFactors.find(row => `macro:${row.factor}` === ref);
    return row ? [{ ref, ...row }] : [];
  });
  return ` SAVED STRATEGIC PRESSURES (AI interpretations, not independent facts or execution authority; signal indexes belong only to the original model check): ${JSON.stringify({ market: value.market, customerSegment: value.customerSegment, geography: value.geography, scopeBasis: value.scopeBasis, scopeLimitation: value.scopeLimitation, decisionSummary: value.decisionSummary, priorities, unassessedForces: value.unassessedForces, unassessedMacroFactors: value.unassessedMacroFactors })}. Recheck the original evidence before relying on any claimed effect; preserve all creative modes.`;
}
