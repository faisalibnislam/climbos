export interface SavedPlanDecisionSummary {
  diagnosis: string | null;
  /** Original values saved with the plan, before current owner inputs recalculate them on read. */
  plays: { id: string; name: string; kind: string; oneLiner: string; unit: string; p10: number | null; p50: number | null; p90: number | null }[] | null;
  portfolio: { selected: string[]; customers: number | null; horizonDays: number | null } | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Extract only saved, explainable choices; do not use read-time recalculated values as history. */
export function savedPlanDecisionSummary(expert: unknown): SavedPlanDecisionSummary | null {
  const x = record(expert);
  if (!x) return null;
  const plays = Array.isArray(x.plays)
    ? x.plays.flatMap((value) => {
        const play = record(value);
        const name = string(play?.name);
        if (!play || !name) return [];
        return [{
          id: string(play.id) ?? `name:${name.toLocaleLowerCase()}`,
          name,
          kind: string(play.kind) ?? "",
          oneLiner: string(play.oneLiner) ?? "",
          unit: string(play.unit) ?? "",
          p10: finite(play.p10),
          p50: finite(play.p50),
          p90: finite(play.p90),
        }];
      })
    : null;
  const rawPortfolio = record(x.portfolio);
  const portfolio = rawPortfolio
    ? {
        selected: Array.isArray(rawPortfolio.selected) ? rawPortfolio.selected.filter((name): name is string => typeof name === "string" && Boolean(name.trim())).map((name) => name.trim()) : [],
        customers: finite(rawPortfolio.customers),
        horizonDays: finite(record(x.snapshot)?.horizonDays),
      }
    : null;
  return { diagnosis: string(x.diagnosis), plays, portfolio };
}
