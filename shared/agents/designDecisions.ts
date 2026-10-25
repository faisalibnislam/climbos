/**
 * Owner decisions on Design Critic findings carry across audit runs. A finding's identity is its lens, page path,
 * and page region (observation wording changes between runs). Matching is a review aid, not proof that two
 * findings are the same issue.
 */

export type FindingDecisionStatus = "accepted" | "dismissed" | "deferred" | "resolved" | "reopened" | "corrected" | "needs_information";

export interface FindingIdentity { lens?: string; sourceUrl?: string; region?: string }

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);

export function findingFingerprint(f: FindingIdentity): string | null {
  if (!f.lens || !f.sourceUrl || !f.region) return null;
  let path = "";
  try {
    const url = new URL(f.sourceUrl);
    path = `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "") || "/"}`;
  } catch {
    return null;
  }
  const region = words(f.region).slice(0, 4).join(" ");
  return region ? `${f.lens}|${path.toLowerCase()}|${region}` : null;
}

export interface PriorDecision extends FindingIdentity {
  observation?: string;
  status: FindingDecisionStatus;
  note?: string;
  decidedAt: number;
  runId: string;
  runCreatedAt: number;
}

/** Latest decision per fingerprint (newest first wins); unmatched or unfingerprintable rows are dropped. */
export function latestDecisions(decisions: readonly PriorDecision[]): Map<string, PriorDecision> {
  const out = new Map<string, PriorDecision>();
  for (const d of [...decisions].sort((a, b) => b.decidedAt - a.decidedAt)) {
    const key = findingFingerprint(d);
    if (key && !out.has(key)) out.set(key, d);
  }
  return out;
}

const STATUS_RULE: Partial<Record<FindingDecisionStatus, string>> = {
  dismissed: "the owner dismissed it: don't raise it again unless the page evidence has changed, and then say what changed",
  resolved: "the owner marked it resolved: check the current page and only report it again if the problem is still visible",
  accepted: "the owner accepted it: keep it if still visible and note any progress",
  deferred: "the owner deferred it: keep it at its honest priority without escalating",
  corrected: "the owner corrected it: follow the owner's correction",
  needs_information: "the owner asked for more information: supply the missing evidence or say what is still unknown",
};

/** Prompt context for the next audit; owner notes are returned separately for an untrusted wrapper. */
export function priorDecisionsBrief(latest: Map<string, PriorDecision>): { summary: string; notes: string[] } {
  const rows = [...latest.values()].filter((d) => STATUS_RULE[d.status]).slice(0, 12);
  if (!rows.length) return { summary: "", notes: [] };
  return {
    summary: `PRIOR OWNER DECISIONS ON WEBSITE FINDINGS (from earlier audits; matched by lens, page and region, which is a review aid, not proof of the same issue): ${rows.map((d) => `[${d.status.replace(/_/g, " ")}] ${d.lens} · ${d.sourceUrl} · ${d.region}: ${STATUS_RULE[d.status]}`).join("; ")}.`,
    notes: rows.filter((d) => d.note?.trim()).map((d) => `${d.lens} · ${d.region}: ${d.note!.trim().slice(0, 300)}`),
  };
}
