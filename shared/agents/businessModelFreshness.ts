import { z } from "zod";

export const MODEL_EVIDENCE_GROUPS = ["workspace", "business", "facts", "brand", "goal", "billing", "pipeline", "competitors"] as const;
export type ModelEvidenceGroup = typeof MODEL_EVIDENCE_GROUPS[number];
export const MODEL_EVIDENCE_LABELS: Record<ModelEvidenceGroup, string> = { workspace: "Workspace context", business: "Business details and economics", facts: "Reviewed business facts", brand: "Brand guidance", goal: "Goal and constraints", billing: "Imported billing records", pipeline: "Sales records", competitors: "Saved competitor observations" };
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const BusinessModelEvidenceSchema = z.object({
  version: z.literal(1), contextHash: hash, capturedAt: z.number().finite().nonnegative(),
  hashes: z.object({ workspace: hash, business: hash, facts: hash, brand: hash, goal: hash, billing: hash, pipeline: hash, competitors: hash }),
});
export type BusinessModelEvidence = z.infer<typeof BusinessModelEvidenceSchema>;
/** Product review interval, not proof that a judgment becomes wrong on day 30. */
export const BUSINESS_MODEL_REVIEW_DAYS = 30;
export interface BusinessModelFreshness {
  status: "unchanged" | "changed" | "review_due" | "unknown";
  changed: ModelEvidenceGroup[];
  capturedAt: number | null;
  checkedAt: number;
  reason: string;
}

export function readBusinessModelEvidence(input: string): BusinessModelEvidence | null {
  try {
    const parsed = BusinessModelEvidenceSchema.safeParse(JSON.parse(input)?.businessModelEvidence);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function businessModelFreshness(snapshot: BusinessModelEvidence | null, current: BusinessModelEvidence["hashes"], now: number): BusinessModelFreshness {
  const base = { capturedAt: snapshot?.capturedAt ?? null, checkedAt: now, changed: [] as ModelEvidenceGroup[] };
  if (!snapshot || snapshot.capturedAt > now) return { ...base, status: "unknown", reason: "No usable record of the original inputs is available. Treat this report as historical advice until reviewed." };
  const changed = MODEL_EVIDENCE_GROUPS.filter(group => snapshot.hashes[group] !== current[group]);
  if (changed.length) return { ...base, changed, status: "changed", reason: "Inputs changed since this check. Review the saved report or run a new check before using its verdict as current advice." };
  if (now - snapshot.capturedAt >= BUSINESS_MODEL_REVIEW_DAYS * 86_400_000) return { ...base, status: "review_due", reason: "This report reached the 30-day review interval. That is a product review reminder, not proof the judgment is wrong." };
  return { ...base, status: "unchanged", reason: "The checked business records still match this report. That does not confirm the advice is correct." };
}
