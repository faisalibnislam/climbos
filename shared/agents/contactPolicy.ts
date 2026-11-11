import type { Source } from "../ai/types";
import type { AgentInput, LintIssue } from "./types";

/** Narrow observed refusal; absence is unknown, never permission or availability. */
export function productPitchRefusal(text: string): Source["productPitchPolicy"] {
  const flat = text.replace(/\s+/g, " ");
  const match = flat.match(/\b(?:does? not|do not|don['’]t|not currently)\s+accept(?:ing)?\b[^.!?]{0,220}\b(?:marketing partnerships|free products for review|product[- ]review requests)\b[^.!?]*/i)
    ?? flat.match(/\b(?:do not|don['’]t)\s+ask\b[^.!?]{0,90}\b(?:review|link to)\b[^.!?]{0,50}\byour product\b[^.!?]*/i);
  return match ? { status: "refused", evidence: match[0].slice(0, 400) } : undefined;
}

/** A retrieved refusal overrides a suggested outreach draft; a public page is not consent. */
export function lintRefusedOutreach(work: { kind: string; target: string; draft: string }[] | undefined, input: AgentInput): LintIssue[] {
  const refused = (input.precomputedResearch?.sources ?? []).filter(s => s.productPitchPolicy?.status === "refused");
  return (work ?? []).flatMap((item, i) => {
    if (item.kind !== "creator_pitch") return [];
    const target = item.target.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hit = refused.find(source => {
      try { const host = new URL(source.url).hostname.replace(/^www\./, ""); const brand = host.split(".").slice(0, -1).join(""); return brand.length >= 4 && target.includes(brand.replace(/[^a-z0-9]/g, "")); } catch { return false; }
    });
    return hit ? [{ severity: "error" as const, rule: "contact_policy", path: `preparedWork[${i}]`, message: `The target's retrieved page refuses this product outreach: ${hit.url}. Exclude this pitch; do not route it through a topic or support form. Prepare another eligible approach or owned demonstration instead.` }] : [];
  });
}
