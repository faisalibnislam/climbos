import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { citedUrls, excerptIn, verifyActionEvidence } from "../../shared/agents/provenance";
import { ACTION_EVIDENCE_POLICY, playsTask } from "../../shared/agents/planTasks";
import { lintActionContracts, type PlayDraft } from "../../shared/agents/specs";
import { EvidenceReferences } from "../../src/components/app/plan/EvidenceReferences";

const facts = ["Repeat customers placed 42 orders in September, according to the owner's order export."];
const page = "Pricing. The starter plan costs $29 a month and includes unlimited projects for small teams.";
const contract = (o: Partial<PlayDraft["actionContract"]> = {}): PlayDraft["actionContract"] => ({
  diagnosis: "Repeat orders are the constraint.",
  intendedEffect: "More second orders.",
  evidenceBasis: "source_claim",
  evidenceNote: "Owner export and pricing page.",
  evidenceRefs: ["fact:0", "https://real.example/pricing"],
  targetOrAsset: "Order follow-up email",
  resourcePlan: "Two hours a week",
  executionCapability: "owner",
  dependencies: [],
  measurement: { metric: "Repeat orders", baseline: "42 in September", target: "50", windowDays: 30, source: "Order export" },
  ...o,
});
const drafted = (o: Partial<PlayDraft["actionContract"]> = {}) => ({ name: "Repeat order follow-up", kind: "bankable", unit: "repeat orders", actionContract: contract(o) }) as unknown as PlayDraft;

describe("action evidence claim support", () => {
  it("matches excerpts word for word, ignoring case, curly quotes and spacing, and rejects fragments", () => {
    expect(excerptIn("The STARTER plan  costs $29 a month", page)).toBe(true);
    expect(excerptIn("The starter plan costs $19 a month", page)).toBe(false);
    expect(excerptIn("$29", page)).toBe(false);
    expect(excerptIn("owner’s order export", "the owner's order export")).toBe(true);
  });

  it("lint rejects fact excerpts not in the fact and excerpts for other references, and asks for missing ones", () => {
    const wrongFact = drafted({ evidenceExcerpts: [{ ref: "fact:0", excerpt: "Repeat customers placed 90 orders in September" }] });
    const issues = lintActionContracts([wrongFact], 1, "https://real.example/pricing", 30, ["https://real.example/pricing"], facts);
    expect(issues.some((i) => i.severity === "error" && /isn't in that fact/.test(i.message))).toBe(true);
    expect(issues.some((i) => i.severity === "warn" && /https:\/\/real\.example\/pricing/.test(i.message))).toBe(true);

    const stray = drafted({ evidenceExcerpts: [{ ref: "https://other.example", excerpt: "Something that was never cited here" }] });
    expect(lintActionContracts([stray], 1, "https://real.example/pricing", 30, ["https://real.example/pricing"], facts).some((i) => /doesn't match one of this action's evidence references/.test(i.message))).toBe(true);

    const good = drafted({ evidenceExcerpts: [{ ref: "fact:0", excerpt: "Repeat customers placed 42 orders in September" }, { ref: "https://real.example/pricing", excerpt: "The starter plan costs $29 a month" }] });
    expect(lintActionContracts([good], 1, "https://real.example/pricing", 30, ["https://real.example/pricing"], facts).filter((i) => i.rule === "action_evidence")).toEqual([]);
    // Assumption or inference needs no excerpt.
    expect(lintActionContracts([drafted({ evidenceBasis: "inference", evidenceRefs: [] })], 1, "", 30, [], facts).filter((i) => i.rule === "action_evidence")).toEqual([]);
  });

  it("marks each reference found, not found, unavailable, unchecked, or without an excerpt", () => {
    const out = {
      economics: { revenuePerCustomerMonthUsd: 29, grossMargin: 0.5, basis: "" },
      plays: [
        { actionContract: contract({ evidenceRefs: ["fact:0", "https://real.example/pricing", "https://down.example", "https://unloaded.example", "https://noexcerpt.example"], evidenceExcerpts: [
          { ref: "fact:0", excerpt: "Repeat customers placed 42 orders in September" },
          { ref: "https://real.example/pricing", excerpt: "The starter plan costs $19 a month" },
          { ref: "https://down.example", excerpt: "A sentence from a page that failed to load" },
          { ref: "https://unloaded.example", excerpt: "A sentence from a page outside this run" },
        ] }) },
        { actionContract: contract({ evidenceRefs: [] }) },
      ],
    };
    const checked = verifyActionEvidence(out as never, { pages: { "real.example/pricing": page, "down.example": null }, facts }) as typeof out & { plays: { actionContract: { evidenceSupport?: { ref: string; status: string }[] } }[] };
    expect(checked.plays[0].actionContract.evidenceSupport!.map((s) => s.status)).toEqual(["found_in_fact", "not_found", "page_unavailable", "not_loaded", "no_excerpt"]);
    expect(checked.plays[1].actionContract.evidenceSupport).toBeUndefined();
    // A page cited with an excerpt is fetched for the check.
    expect(citedUrls(out as never)).toEqual(expect.arrayContaining(["https://real.example/pricing", "https://down.example", "https://unloaded.example"]));
    expect(citedUrls(out as never)).not.toContain("https://noexcerpt.example");
  });

  it("shows the excerpt, its check, and that a match isn't proof", () => {
    const html = renderToStaticMarkup(createElement(EvidenceReferences, {
      references: ["fact:0", "https://real.example/pricing"],
      excerpts: [{ ref: "fact:0", excerpt: "Repeat customers placed 42 orders" }, { ref: "https://real.example/pricing", excerpt: "The starter plan costs $19 a month" }],
      support: [{ ref: "fact:0", status: "found_in_fact" }, { ref: "https://real.example/pricing", status: "not_found" }],
    }));
    expect(html).toContain("Repeat customers placed 42 orders");
    expect(html).toContain("Excerpt found in the confirmed fact");
    expect(html).toContain("treat the claim as unconfirmed");
    expect(html).toContain("not that they prove the claim");
    // Legacy references without excerpts render as before.
    expect(renderToStaticMarkup(createElement(EvidenceReferences, { references: ["https://real.example/pricing"] }))).not.toContain("Excerpt");
  });

  it("tells the plays writer to copy exact excerpts", () => {
    expect(ACTION_EVIDENCE_POLICY).toContain("copied word for word");
    expect(playsTask({} as never)).toContain("ACTION EVIDENCE");
  });
});
