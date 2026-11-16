import type { FindingDecisionStatus } from "./designDecisions";

export type OpportunityReview = { findingIndex: number; status?: FindingDecisionStatus; note: string; updatedAt: number };
export type DesignOpportunity = {
  runId: string; findingIndex: number; auditedAt: number; capturedAt: number | null;
  sourceUrl: string | null; viewport: string | null; lens: string; region: string;
  observation: string; evidence: string; classification: string; confidence: string;
  relevance: string; goal: string; proposedChange: string;
  checks: string[]; directions: { name: string; responseLevel: string; effort: string; assumptions: string[]; risks: string[] }[];
  review?: OpportunityReview;
};

const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, max = 1200) => typeof v === "string" ? v.trim().slice(0, max) : "";
const strings = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 12).map(x => text(x, 400)).filter(Boolean) : [];
const normalized = (v: string) => v.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

/** Keep query strings, fragments and path case: distinct page variants must not silently merge. */
export function opportunityPageUrl(v: unknown): string | null {
  try {
    const url = new URL(text(v, 2000));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/** Inspect legacy output defensively; these are saved audit judgments, not freshly verified facts. */
export function designOpportunityRows(run: { runId: string; auditedAt: number; output?: string }, reviews: OpportunityReview[]) {
  let output: Record<string, unknown>;
  try { output = object(JSON.parse(run.output ?? "{}")); } catch { return { findings: [] as DesignOpportunity[], unavailable: true }; }
  const critic = object(output.designCritic);
  if (!Array.isArray(critic.findings)) return { findings: [] as DesignOpportunity[], unavailable: true };
  const visual = object(object(object(output.auditCoverage).website).visualReview);
  const findings = critic.findings.slice(0, 12).flatMap((raw, findingIndex): DesignOpportunity[] => {
    const f = object(raw);
    if (!text(f.observation)) return [];
    const view = object(f.visualEvidence).view;
    const sourceUrl = opportunityPageUrl(f.sourceUrl);
    const captureMatches = sourceUrl !== null && sourceUrl === opportunityPageUrl(visual.pageUrl) && visual.state === "reviewed" && Array.isArray(visual.views) && visual.views.includes(view);
    const capturedAt = captureMatches && typeof visual.capturedAt === "number" && Number.isFinite(visual.capturedAt) ? visual.capturedAt : null;
    return [{ runId: run.runId, findingIndex, auditedAt: run.auditedAt, capturedAt,
      sourceUrl, viewport: view === "desktop" || view === "mobile" ? view : null,
      lens: text(f.lens, 100), region: text(f.region, 200), observation: text(f.observation), evidence: text(f.evidence),
      classification: text(f.classification, 100), confidence: text(f.confidence, 40), relevance: text(f.whyItMatters), goal: text(f.businessOrUserGoal), proposedChange: text(f.proposedChange), checks: strings(f.automatedCheckIds),
      directions: (Array.isArray(f.directions) ? f.directions : []).slice(0, 3).map(rawDirection => {
        const d = object(rawDirection);
        return { name: text(d.name, 200), responseLevel: text(d.responseLevel, 80), effort: text(d.effort, 400), assumptions: strings(d.assumptions), risks: strings(d.risks) };
      }), review: reviews.find(r => r.findingIndex === findingIndex),
    }];
  });
  return { findings, unavailable: findings.length !== critic.findings.length };
}

export function groupDesignOpportunities(rows: DesignOpportunity[]) {
  const groups = new Map<string, { key: string; lens: string; region: string; items: Map<string, { latest: DesignOpportunity; history: DesignOpportunity[] }> }>();
  const seen = new Set<string>();
  for (const row of [...rows].sort((a, b) => b.auditedAt - a.auditedAt || b.runId.localeCompare(a.runId))) {
    const reference = `${row.runId}:${row.findingIndex}`;
    if (seen.has(reference)) continue;
    seen.add(reference);
    // Missing identities stay separate. Grouping is a review aid, never a confidence boost.
    const groupKey = row.lens && row.region ? JSON.stringify([normalized(row.lens), normalized(row.region)]) : reference;
    const group = groups.get(groupKey) ?? { key: groupKey, lens: row.lens, region: row.region, items: new Map() };
    const repeatedKey = row.sourceUrl && row.region && row.lens
      ? JSON.stringify([row.sourceUrl, row.viewport, normalized(row.region), normalized(row.lens), row.classification,
        row.classification === "automated_check" && row.checks.length ? [...new Set(row.checks)].sort() : normalized(row.observation)])
      : reference;
    const item = group.items.get(repeatedKey);
    if (item) item.history.push(row);
    else group.items.set(repeatedKey, { latest: row, history: [] });
    groups.set(groupKey, group);
  }
  return [...groups.values()].map(group => ({ ...group, items: [...group.items.values()] }));
}
