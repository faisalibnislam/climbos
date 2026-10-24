/** A small, source-aware projection of saved growth plays for the Growth Home. */

export interface OpportunitySourceInput {
  source?: string;
  ref?: string;
  quote?: string;
  check?: string;
  access?: string;
  checkedBy?: string;
}

export interface OpportunityPlayInput {
  id?: string;
  name?: string;
  oneLiner?: string;
  firstActionToday?: string;
  kind?: string;
  p10?: number;
  p50?: number;
  p90?: number;
  unit?: string;
  horizonDays?: number;
  model?: {
    ownerHoursPerWeek?: number;
    reachSource?: OpportunitySourceInput;
    steps?: OpportunitySourceInput[];
  };
}

export interface OpportunitySource {
  label: string;
  detail?: string;
  url?: string;
  quote?: string;
}

export interface GrowthOpportunity {
  id: string | null;
  title: string;
  why: string;
  nextStep: string;
  ownerHoursPerWeek: number | null;
  sources: OpportunitySource[];
  forecast: { low: number; likely: number; high: number; unit: string; days: number } | null;
}

export interface QuickTakeDraft {
  headline: string;
  opportunities: { title: string; why: string; nextStep: string; factIndexes: number[] }[];
}

export interface QuickTakeFactInput {
  id: string;
  statement: string;
  kind?: string;
}

export interface QuickTakePreview {
  title: string;
  why: string;
  nextStep: string;
  evidence: { factId: string; statement: string; kind?: string }[];
  basis: "confirmed_facts" | "hypothesis";
}

/** Resolve model-selected fact indexes to IDs from the exact ordered input, dropping invalid indexes. */
export function linkQuickTakeEvidence(draft: QuickTakeDraft, facts: readonly QuickTakeFactInput[]): { headline: string; opportunities: QuickTakePreview[] } {
  const opportunities = draft.opportunities.slice(0, 3).map((opportunity) => {
    const indexes = [...new Set(opportunity.factIndexes)].filter((index) => Number.isInteger(index) && index >= 0 && index < facts.length).slice(0, 4);
    const evidence = indexes.map((index) => ({ factId: facts[index].id, statement: facts[index].statement.slice(0, 400), ...(facts[index].kind ? { kind: facts[index].kind } : {}) }));
    return {
      title: opportunity.title.trim().slice(0, 120),
      why: opportunity.why.trim().slice(0, 400),
      nextStep: opportunity.nextStep.trim().slice(0, 300),
      evidence,
      basis: evidence.length ? "confirmed_facts" as const : "hypothesis" as const,
    };
  }).filter((opportunity) => opportunity.title);

  return { headline: draft.headline.trim().slice(0, 200), opportunities };
}

const CHECK_STAMP = "climbos-provenance-1";

function sourceProjection(tag: OpportunitySourceInput): OpportunitySource | null {
  const source = tag.source;
  const ref = tag.ref?.trim() ?? "";
  const url = /^https?:\/\//i.test(ref) ? ref : undefined;
  const quote = tag.quote?.trim().slice(0, 220) || undefined;

  if (source === "owner") {
    return {
      label: tag.checkedBy === CHECK_STAMP && tag.check === "owner_input" ? "Owner-confirmed input" : "Owner-reported, not confirmed",
      ...(quote ? { quote } : {}),
    };
  }
  if (source === "research") {
    const verified = tag.checkedBy === CHECK_STAMP && tag.check === "source_verified" && tag.access === "read";
    return {
      label: verified ? "Verified on source" : tag.access === "read" ? "Page read; claim not verified" : "Search result; page not verified",
      ...(url ? { url } : {}),
      ...(quote ? { quote } : {}),
    };
  }
  if (source === "benchmark") return { label: "Reported benchmark", ...(ref ? { detail: ref.slice(0, 140) } : {}) };
  if (source === "planned") return { label: "Planned input", ...(ref ? { detail: ref.slice(0, 140) } : {}) };
  if (source === "assumption") return { label: "Assumption to test", ...(ref ? { detail: ref.slice(0, 140) } : {}) };
  return null;
}

/** Keep the plan's ordering rationale, citations, and unknown status visible without inventing a score. */
export function projectGrowthOpportunities(plays: readonly OpportunityPlayInput[], limit = 3): GrowthOpportunity[] {
  // The planner's order is the decision order. Don't invent a second ranking here.
  const ordered = plays.filter((play) => typeof play.name === "string" && play.name.trim()).slice(0, Math.max(0, limit));

  return ordered.map((play) => {
    const tags = [play.model?.reachSource, ...(play.model?.steps ?? [])].filter((tag): tag is OpportunitySourceInput => Boolean(tag));
    const seen = new Set<string>();
    const sources = tags
      .map(sourceProjection)
      .filter((source): source is OpportunitySource => {
        if (!source) return false;
        const key = `${source.label}:${source.url ?? source.detail ?? source.quote ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
    const hours = play.model?.ownerHoursPerWeek;
    const forecast = [play.p10, play.p50, play.p90].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) && play.p10! <= play.p50! && play.p50! <= play.p90!
      ? { low: play.p10!, likely: play.p50!, high: play.p90!, unit: play.unit?.trim() || "customers", days: typeof play.horizonDays === "number" && play.horizonDays > 0 ? Math.round(play.horizonDays) : 90 }
      : null;

    return {
      id: play.id ?? null,
      title: play.name!.trim().slice(0, 120),
      why: play.oneLiner?.trim().slice(0, 400) ?? "",
      nextStep: play.firstActionToday?.trim().slice(0, 300) ?? "",
      ownerHoursPerWeek: typeof hours === "number" && Number.isFinite(hours) && hours >= 0 ? hours : null,
      sources,
      forecast,
    };
  });
}
