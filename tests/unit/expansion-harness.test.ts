import { describe, expect, it } from "vitest";
import { checkNumbers, statesNumber } from "../../bench/expansion/numeric";
import { loadCases, loadPrompts, PLAN_CASES, LIBRARY_TYPE } from "../../bench/expansion/cases";
import { judgePrompt, summarize, type GradedRow } from "../../bench/expansion/grade";

/** The 32-case expansion harness: fair inputs, deterministic number checks, honest summaries. */
describe("expansion cases", () => {
  const cases = loadCases();
  const prompts = loadPrompts();
  it("has all 32 cases and a prompt for each", () => {
    expect(cases).toHaveLength(32);
    expect(new Set(prompts.map((p) => p.case_id))).toEqual(new Set(cases.map((c) => c.id)));
  });
  it("never shows the engine an expected answer or hard failure", () => {
    for (const c of cases) {
      const p = prompts.find((x) => x.case_id === c.id)!.prompt;
      for (const s of [...c.expected_behaviors, ...c.hard_failures]) expect(p).not.toContain(s);
    }
  });
  it("plan cases exist and map to library business types", () => {
    for (const id of PLAN_CASES) {
      const c = cases.find((x) => x.id === id)!;
      expect(LIBRARY_TYPE[c.business_type]).toBeTruthy();
    }
  });
  it("the judge sees the case's own and the global hard failures", () => {
    const c = cases.find((x) => x.id === "EV03")!;
    const p = judgePrompt(c, "answer");
    expect(p).toContain(c.hard_failures[0]);
    expect(p).toMatch(/Materially incorrect arithmetic/);
    expect(p).toContain("<answer>\nanswer\n</answer>");
  });
});

describe("numeric checks", () => {
  it("finds values in their usual written forms", () => {
    expect(statesNumber("Total defined cost is $21 per account.", 21)).toBeTruthy();
    expect(statesNumber("That's a 30% contribution margin.", 0.3)).toBeTruthy();
    expect(statesNumber("margin of 0.30 under this boundary", 0.3)).toBeTruthy();
    expect(statesNumber("a 1 percentage point difference", 0.01)).toBeTruthy();
    expect(statesNumber("relative change is 50%", 0.5)).toBeTruthy();
    expect(statesNumber("about 6.7% at $15", 0.06666666666666667)).toBeTruthy();
    expect(statesNumber("contribution of $1,800 before acquisition", 1800)).toBeTruthy();
  });
  it("doesn't match a different number that contains the digits", () => {
    expect(statesNumber("costs $210 a month", 21)).toBeNull();
    expect(statesNumber("2.1 hours", 21)).toBeNull();
    expect(statesNumber("130% of plan", 0.3)).toBeNull();
  });
  it("reports each check", () => {
    const r = checkNumbers("Contribution $9; margin 30%.", [{ formula: "contribution", expected: 9 }, { formula: "contribution_margin", expected: 0.3 }, { formula: "sum_defined_cost", expected: 21 }]);
    expect(r.map((x) => x.found)).toEqual([true, true, false]);
  });
});

describe("summary", () => {
  it("counts hard fails and failed runs apart from scores", () => {
    const scores = { evidence_integrity: 2, diagnosis: 2, business_fit: 1, economics_measurement: 2, actionability: 1, uncertainty: 2, execution_control: 2 };
    const rows: GradedRow[] = [
      { case_id: "EV01", surface: "advisor", ok: true, numbers: [], judgement: { scores, hard_failures: [], notes: "" }, hard_fail: false, total: 12 },
      { case_id: "EV03", surface: "advisor", ok: true, numbers: [{ formula: "c", expected: 9, found: false }], judgement: { scores, hard_failures: [{ failure: "x", present: true, why: "y" }], notes: "" }, hard_fail: true, total: 12 },
      { case_id: "EV08", surface: "advisor", ok: false, numbers: [], judgement: { error: "no answer" }, hard_fail: true, total: null },
    ];
    const s = summarize(rows);
    expect(s).toMatchObject({ runs: 3, failed_runs: 1, hard_fails: 2, numbers_found: "0/1", mean_total: 12 });
    expect(s.dims.business_fit).toBe(1);
  });
});
