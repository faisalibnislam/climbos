import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { livoformLaunchInput, livoformLaunchComparison, LIVOFORM_LAUNCH_QUESTIONS, normalizeLaunchComparison, parseLaunchEvidencePack } from "../../bench/strategy-quality/livoformLaunch";
import { LIVOFORM_PUBLIC_DOCS } from "../../bench/strategy-quality/livoformPublicDocs";
import { referenceEvidenceBasis } from "../../shared/agents/evidenceKind";

// Synthetic reports exercise provenance; these are not claims about the real business.
const owner = { website: "https://livoform.com/", reportedAt: "2026-11-17", statements: ["Synthetic test: the owner is exploring a new segment.", "Synthetic test: operating capacity is unknown."] };
const now = Date.parse("2026-11-17T12:00:00Z");
describe("owner-selected Livoform launch acceptance", () => {
  it("keeps owner reports separate from measured metrics and public site claims", () => {
    const input = livoformLaunchInput(owner, now);
    expect(input.facts).toEqual(owner.statements.map(statement => `Owner reports (${owner.reportedAt}): ${statement}`));
    for (let index = 0; index < input.facts.length; index++) expect(referenceEvidenceBasis(`fact:${index}`, input.constraints?.factEvidenceBases, input.availableSourceUrls!)).toBe("owner_reported");
    expect(referenceEvidenceBasis("https://livoform.com/pricing", input.constraints?.factEvidenceBases, input.availableSourceUrls!)).toBe("source_reported");
    expect(input.constraints).not.toHaveProperty("funnel");
    expect(input.constraints).not.toHaveProperty("emailAudience");
    expect(input.constraints).not.toHaveProperty("serviceArea");
    expect(input.precomputedResearch?.notes).toContain("demonstration content, not business traffic");
  });
  it("retains inspected source identity, failed-read limits and unknown source freshness", () => {
    const input = livoformLaunchInput(owner, now);
    expect(input.availableSourceUrls).toEqual(["https://livoform.com/", "https://livoform.com/pricing"]);
    expect(input.precomputedResearch).not.toHaveProperty("retrievedAt");
    expect(input.precomputedResearch?.notes).toContain("Retrieval failed");
    expect(input.precomputedResearch?.notes).toContain("annual billing, not monthly charges");
    expect(input.ownerSuppliedUrls).toEqual(["https://livoform.com/"]);
    expect(createHash("sha256").update(input.precomputedResearch!.notes).digest("hex")).toBe("106af423ecf856840b05c52204be1bd5a6984b10639c67d77d03a974e2c5a8c6");
  });
  it("adds dated public documentation only when explicitly selected, without inventing owner resources", () => {
    const original = livoformLaunchInput(owner, now);
    const enriched = livoformLaunchInput(owner, now, "public-docs-20261118");
    expect(enriched.facts).toEqual(original.facts);
    expect(enriched.constraints).toEqual(original.constraints);
    expect(enriched.brief).toEqual(original.brief);
    expect(enriched.task).toEqual(original.task);
    expect(enriched.creativeRetrievalQuery).toEqual(original.creativeRetrievalQuery);
    expect(enriched.ownerSuppliedUrls).toEqual(original.ownerSuppliedUrls);
    expect(enriched.availableSourceUrls).toHaveLength(8);
    expect(new Set(enriched.availableSourceUrls).size).toBe(8);
    expect(enriched.precomputedResearch).not.toHaveProperty("retrievedAt");
    const notes = enriched.precomputedResearch!.notes;
    for (const source of LIVOFORM_PUBLIC_DOCS) {
      expect(enriched.availableSourceUrls).toContain(source.url);
      expect(referenceEvidenceBasis(source.url, enriched.constraints?.factEvidenceBases, enriched.availableSourceUrls!)).toBe("source_reported");
      expect(notes).toContain(source.retrievedAt);
      expect(notes).toContain(`publisher update date ${source.updatedAt ?? "unknown"}`);
    }
    expect(notes).toContain("earlier failed read of /integrations/chatgpt-claude is superseded");
    expect(notes).toContain("/templates pages remain uninspected");
    expect(notes).not.toContain("Retrieval failed for these three URLs");
    expect(notes).toContain("no built-in Livoform AI");
    expect(notes).toContain("explicitly includes everything in Core");
    expect(notes).toContain("rk_test_");
    expect(notes).toContain("not proof that collected answers become a client-ready deliverable");
    expect(notes).toContain("No product or payment behavior was tested");
    expect(notes).toContain("No connector has been connected or tested");
    expect(notes).toContain("do not grant ClimbOS access or execution authority");
  });
  it("rejects unknown packs and refuses to silently ignore pack selection on another stage", () => {
    expect(parseLaunchEvidencePack("launch-acceptance")).toBe("original");
    expect(parseLaunchEvidencePack("launch-acceptance", "public-docs-20261118")).toBe("public-docs-20261118");
    expect(() => parseLaunchEvidencePack("launch-acceptance", "guessed-pack")).toThrow();
    for (const stage of ["launch-judge", "plans", "industries"]) expect(() => parseLaunchEvidencePack(stage, "original")).toThrow("only accepted");
  });
  it("uses the shared focused task with an evaluation clock, no source of execution authority", () => {
    const input = livoformLaunchInput(owner, now);
    expect(input.timingContext).toEqual({ today: "2026-11-17", timezone: "UTC", now });
    expect(input.brief).toContain("No external action is authorized");
    expect(input.brief).toContain("evaluation choices");
    expect(input.constraints?.monthlyAdBudgetUsd).toBe(0);
    expect(input.creativeRetrievalQuery).not.toContain("YOUR TASK");
    expect(input.creativeRetrievalQuery).toContain("conditional logic");
    expect(input.creativeRetrievalQuery).toContain("source-reported");
    expect(input.creativeRetrievalQuery).not.toContain("ACCEPTANCE CASE");
    expect(input.task).not.toContain(LIVOFORM_LAUNCH_QUESTIONS[0]);
    expect(input.task.match(/PROTECTED STRATEGY EXPLORATION:/g)).toHaveLength(1);
    expect(input.task).toContain("CREATIVITY PREFERENCE: balanced");
    expect(() => livoformLaunchInput(owner, NaN)).toThrow();
    expect(() => livoformLaunchInput({ ...owner, website: "https://elsewhere.example/" }, now)).toThrow();
    expect(() => livoformLaunchInput({ ...owner, statements: [] }, now)).toThrow();
    expect(() => livoformLaunchInput({ ...owner, reportedAt: "2026-02-31" }, now)).toThrow();
  });
});


describe("held-out launch comparison", () => {
  it("requires every question exactly once while preserving supplied scores and the original question wording", () => {
    const response = { verdict: "neither", questions: Object.fromEntries(LIVOFORM_LAUNCH_QUESTIONS.map((_, index) => [`q${index + 1}`, { A: index % 5 + 1, B: 2, evidence: "Synthetic comparison evidence." }])), criticalErrors: [], usefulNextStep: { A: false, B: false, reason: "Fixture only." }, improvements: [], summary: "Synthetic test, no model quality claim." };
    const normalized = normalizeLaunchComparison(response);
    expect(normalized.questions.map(row => row.question)).toEqual(LIVOFORM_LAUNCH_QUESTIONS);
    normalized.questions.forEach((row, index) => expect(row).toMatchObject(response.questions[`q${index + 1}`]));
    const missing = structuredClone(response); delete missing.questions.q6;
    expect(() => normalizeLaunchComparison(missing)).toThrow();
    expect(() => normalizeLaunchComparison({ ...response, questions: { ...response.questions, q7: response.questions.q1 } })).toThrow();
    expect(() => normalizeLaunchComparison({ ...response, questions: normalized.questions })).toThrow();
  });
  const record = () => ({ caseId: "livoform", schemaPassed: true, input: livoformLaunchInput(owner, now), result: { output: { summary: "Synthetic draft" }, assessment: { ship: false }, history: [{ score: 1 }] } });
  it("passes only candidate output and common evidence to a judge, without grades or drafting instructions", () => {
    const a = record(), b = record(); b.input.task = "A newer writer instruction"; b.input.timingContext!.now!++;
    const comparison = livoformLaunchComparison(a, b);
    expect(comparison.questions).toEqual(LIVOFORM_LAUNCH_QUESTIONS);
    expect(comparison.A).toEqual(a.result.output);
    expect(comparison).not.toHaveProperty("task");
    expect(JSON.stringify(comparison)).not.toContain('"assessment"');
    expect(JSON.stringify(comparison)).not.toContain('"history"');
  });
  it.each(["facts", "research", "constraints"])("refuses a comparison with changed %s", kind => {
    const a = record(), b = record();
    if (kind === "facts") b.input.facts.push("Different synthetic owner report");
    if (kind === "research") b.input.precomputedResearch!.notes += " New evidence";
    if (kind === "constraints") b.input.constraints!.monthlyAdBudgetUsd = 50;
    expect(() => livoformLaunchComparison(a, b)).toThrow("identical business evidence");
  });
  it("refuses incomplete or unrelated artifacts", () => {
    const a = record();
    expect(() => livoformLaunchComparison(a, { ...a, schemaPassed: false })).toThrow();
    expect(() => livoformLaunchComparison(a, { ...a, caseId: "different" })).toThrow();
    expect(() => livoformLaunchComparison(a, { ...a, result: undefined })).toThrow();
  });
  it("cannot attribute different source packs to a code-only improvement", () => {
    const a = record(), b = record();
    b.input = livoformLaunchInput(owner, now, "public-docs-20261118");
    expect(() => livoformLaunchComparison(a, b)).toThrow("identical business evidence");
    a.input = livoformLaunchInput(owner, now, "public-docs-20261118");
    expect(livoformLaunchComparison(a, b).research).toEqual(a.input.precomputedResearch);
  });
});
