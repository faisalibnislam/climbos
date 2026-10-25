/**
 * The evidence pack saved with each plan version (Book 13 §3, Book 14 §4–5).
 *
 * The plan's prose is rewritten by several passes; this keeps what the engine
 * was actually given, so an old plan can be explained and reproduced: the
 * confirmed facts, the insights brief, each agent's research notes and sources,
 * and the versions of the engine, skills and models. Bounded so a version stays
 * well under Convex's document limit.
 */
import { skillVersion } from "../skills";
import { ENGINE_VERSION } from "./specs";
import type { FactConflict } from "./conflicts";

export const EVIDENCE_VERSION = 2;

const CAP = { facts: 60, fact: 600, insights: 24_000, notes: 20_000, sources: 40, goal: 400 };

export interface PlanEvidence {
  version: typeof EVIDENCE_VERSION;
  engine: string;
  /** Skill id → content hash of the compiled skill the agents were given. */
  skills: Record<string, string>;
  /** Agent id → model per phase (as routed for this run). */
  models?: Record<string, unknown>;
  /** Workspace currency every amount in the plan is in. */
  currency: string;
  goal: { statement: string; horizonDays: number; monthlyAdBudget: number; target?: unknown } | null;
  /** Confirmed facts given to the agents, with their ids (owner-confirmed or edited). */
  facts: { id: string; statement: string; category?: string; confidence?: "high" | "medium" | "low"; provenance?: string; evidenceKind?: string; verifiedAt?: number; daysSinceVerification?: number }[];
  /** Previously confirmed facts that were shown only as stale context and could not ground current claims. */
  staleFacts?: { id: string; statement: string; category?: string; confidence?: "high" | "medium" | "low"; provenance?: string; verifiedAt?: number; daysSinceVerification?: number }[];
  /** Owner-confirmed unit economics at the time. */
  ownerEconomics?: unknown;
  insights: string;
  /** Confirmed facts that disagree, kept side by side. */
  conflicts?: FactConflict[];
  /** Each agent's research, as it reached the writer. */
  research: { agentId: string; notes: string; sources: { url: string; title?: string }[] }[];
  /** True where a cap cut something (so a reader knows the record is partial). */
  truncated: string[];
}

export function buildPlanEvidence(p: {
  skillIds: string[];
  models?: Record<string, unknown>;
  currency: string;
  goal: PlanEvidence["goal"];
  facts: PlanEvidence["facts"];
  staleFacts?: NonNullable<PlanEvidence["staleFacts"]>;
  ownerEconomics?: unknown;
  insights: string;
  conflicts?: FactConflict[];
  research: { agentId: string; notes?: string; sources?: { url: string; title?: string }[] }[];
}): PlanEvidence {
  const truncated: string[] = [];
  const cut = (s: string, n: number, what: string) => {
    if (s.length <= n) return s;
    truncated.push(what);
    return s.slice(0, n);
  };
  if (p.facts.length > CAP.facts) truncated.push("facts");
  return {
    version: EVIDENCE_VERSION,
    engine: ENGINE_VERSION,
    skills: Object.fromEntries([...new Set(p.skillIds)].sort().map((id) => [id, skillVersion(id)])),
    ...(p.models ? { models: p.models } : {}),
    currency: p.currency,
    goal: p.goal ? { ...p.goal, statement: cut(p.goal.statement, CAP.goal, "goal") } : null,
    facts: p.facts.slice(0, CAP.facts).map((f) => ({ ...f, statement: cut(f.statement, CAP.fact, `fact ${f.id}`) })),
    ...(p.staleFacts?.length ? { staleFacts: p.staleFacts.slice(0, CAP.facts).map((f) => ({ ...f, statement: cut(f.statement, CAP.fact, `stale fact ${f.id}`) })) } : {}),
    ...(p.ownerEconomics ? { ownerEconomics: p.ownerEconomics } : {}),
    insights: cut(p.insights, CAP.insights, "insights"),
    ...(p.conflicts?.length ? { conflicts: p.conflicts } : {}),
    research: p.research
      .filter((r) => r.notes || r.sources?.length)
      .map((r) => ({ agentId: r.agentId, notes: cut(r.notes ?? "", CAP.notes, `research ${r.agentId}`), sources: (r.sources ?? []).slice(0, CAP.sources).map((x) => ({ url: x.url.slice(0, 500), ...(x.title ? { title: x.title.slice(0, 200) } : {}) })) })),
    truncated,
  };
}

/** A source a channel or audience rests on, resolved from the writer's cites at save time. */
export type EvidenceRef = { kind: "fact"; factId: string } | { kind: "web"; url: string; title?: string };

/**
 * "fact:N" → the Nth confirmed fact the writer was given (same order as `factIds`);
 * a URL → that page (titled when the run's sources know it). Unresolvable cites are dropped:
 * the plan's lint already failed them.
 */
export function resolveCites(cites: string[] | undefined, factIds: string[], sources: { url: string; title?: string }[] = []): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  const seen = new Set<string>();
  const key = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/+$/, "");
  for (const c of cites ?? []) {
    const f = /^fact:(\d+)$/i.exec(c.trim());
    if (f) {
      const id = factIds[Number(f[1])];
      if (id && !seen.has(id)) out.push({ kind: "fact", factId: id });
      if (id) seen.add(id);
    } else if (/^https?:\/\//i.test(c.trim())) {
      const k = key(c);
      if (seen.has(k)) continue;
      seen.add(k);
      const title = sources.find((s) => key(s.url) === k)?.title;
      out.push({ kind: "web", url: c.trim().slice(0, 500), ...(title ? { title: title.slice(0, 200) } : {}) });
    }
    if (out.length >= 6) break;
  }
  return out;
}
