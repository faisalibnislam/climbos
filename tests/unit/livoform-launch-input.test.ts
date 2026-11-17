import { describe, expect, it } from "vitest";
import { livoformLaunchInput, livoformLaunchComparison, LIVOFORM_LAUNCH_QUESTIONS } from "../../bench/strategy-quality/livoformLaunch";
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
  });
  it("uses the shared focused task with an evaluation clock, no source of execution authority", () => {
    const input = livoformLaunchInput(owner, now);
    expect(input.timingContext).toEqual({ today: "2026-11-17", timezone: "UTC", now });
    expect(input.brief).toContain("No external action is authorized");
    expect(input.brief).toContain("evaluation choices");
    expect(input.constraints?.monthlyAdBudgetUsd).toBe(0);
    expect(input.creativeRetrievalQuery).not.toContain("YOUR TASK");
    expect(input.task).not.toContain(LIVOFORM_LAUNCH_QUESTIONS[0]);
    expect(() => livoformLaunchInput(owner, NaN)).toThrow();
    expect(() => livoformLaunchInput({ ...owner, website: "https://elsewhere.example/" }, now)).toThrow();
    expect(() => livoformLaunchInput({ ...owner, statements: [] }, now)).toThrow();
    expect(() => livoformLaunchInput({ ...owner, reportedAt: "2026-02-31" }, now)).toThrow();
  });
});


describe("held-out launch comparison", () => {
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
});
