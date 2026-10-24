import { describe, expect, it } from "vitest";
import { checkNumbers, statesNumber } from "../../bench/expansion/numeric";
import { fixtureIdentity, loadCases, loadPrompts, PLAN_CASES, LIBRARY_TYPE, RUBRIC } from "../../bench/expansion/cases";
import { assertComparableRuns, judgePrompt, summarize, type GradedRow } from "../../bench/expansion/grade";
import { createHumanReviewPacket, summarizeHumanReview, type ExpansionRun } from "../../bench/expansion/human-review";

/** The 32-case expansion harness: fair inputs, deterministic number checks, honest summaries. */
describe("expansion cases", () => {
  const cases = loadCases();
  const prompts = loadPrompts();
  it("has all 32 cases and a prompt for each", () => {
    expect(cases).toHaveLength(32);
    expect(new Set(prompts.map((p) => p.case_id))).toEqual(new Set(cases.map((c) => c.id)));
  });
  it("has a reproducible content identity for the cases and exact owner prompts", () => {
    const first = fixtureIdentity();
    expect(first).toEqual(fixtureIdentity());
    expect(first.version).toBe(1);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
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
    expect(s.by_business_type.saas).toMatchObject({ runs: 2, hard_fails: 1, mean_total: 12 });
    expect(s.by_business_type.mac_app).toMatchObject({ runs: 1, failed_runs: 1, mean_total: null });
  });

  it("refuses pairwise comparisons with changed fixtures or incomplete case coverage", () => {
    const meta = { fixture_version: 1, fixture_sha256: "a".repeat(64) };
    const row = { case_id: "EV01", surface: "advisor" as const, ok: true, response: "A", tool_calls: [], cost_micros: 0, elapsed_seconds: 1 };
    const run = (fixture_sha256: string, rows = [row]) => ({ meta: { ...meta, fixture_sha256 }, rows });
    expect(() => assertComparableRuns(run("a".repeat(64)), run("b".repeat(64)))).toThrow(/different or unversioned/);
    expect(() => assertComparableRuns(run("a".repeat(64)), run("a".repeat(64), []))).toThrow(/different, empty, or duplicate/);
    expect(() => assertComparableRuns(run("a".repeat(64)), run("a".repeat(64), [row, row]))).toThrow(/different, empty, or duplicate/);
    expect(() => assertComparableRuns(run("a".repeat(64)), run("a".repeat(64)))).not.toThrow();
  });
});

describe("blinded human review", () => {
  const allCases = loadCases();
  const selected = allCases.filter((c) => ["EV01", "EV06"].includes(c.id));
  const run = (label: string, suffix: string): ExpansionRun => ({
    meta: { label },
    rows: selected.map((c) => ({ case_id: c.id, surface: "advisor", ok: true, response: `${suffix} ${c.id}`, tool_calls: [], cost_micros: 0, elapsed_seconds: 1 })),
  });

  it("exports reproducible, blinded paired answers with a separate arm key", () => {
    const first = createHumanReviewPacket(run("baseline", "one"), run("candidate", "two"), allCases, "review-seed");
    const again = createHumanReviewPacket(run("baseline", "one"), run("candidate", "two"), allCases, "review-seed");
    expect(first.packet).toEqual(again.packet);
    expect(first.key).toEqual(again.key);
    expect(first.packet.items).toHaveLength(2);
    expect(JSON.stringify(first.packet)).not.toContain("baseline");
    expect(JSON.stringify(first.packet)).not.toContain("candidate response");
    for (const item of first.packet.items) {
      const baselineLabel = first.key.mapping[item.item_id].baseline;
      expect(baselineLabel === "A" ? item.answer_a : item.answer_b).toMatch(/^one /);
      expect(baselineLabel === "A" ? item.answer_b : item.answer_a).toMatch(/^two /);
    }
    for (const item of first.packet.items) {
      expect(Object.keys(item.ratings.answer_a)).toHaveLength(7);
      expect(Object.values(item.ratings.hard_failures_a)).toContain(null);
    }
  });

  it("summarizes human scores and preferences using the private randomized mapping", () => {
    const { packet, key } = createHumanReviewPacket(run("baseline", "one"), run("candidate", "two"), allCases, "other-seed");
    packet.reviewer_id = "reviewer-1";
    for (const item of packet.items) {
      item.ratings.answer_a = Object.fromEntries(RUBRIC.map(({ key: k }) => [k, 2])) as typeof item.ratings.answer_a;
      item.ratings.answer_b = Object.fromEntries(RUBRIC.map(({ key: k }) => [k, 1])) as typeof item.ratings.answer_b;
      item.ratings.hard_failures_a = Object.fromEntries(Object.keys(item.ratings.hard_failures_a).map((k) => [k, false]));
      item.ratings.hard_failures_b = Object.fromEntries(Object.keys(item.ratings.hard_failures_b).map((k) => [k, false]));
      item.ratings.preferred = key.mapping[item.item_id].baseline;
    }
    const summary = summarizeHumanReview(packet, key);
    expect(summary).toMatchObject({ reviewed: 2, incomplete: 0, pairwise: { baseline: 2, candidate: 0, tie: 0 }, hard_failures: { baseline: 0, candidate: 0 } });
    const baselineA = Object.values(key.mapping).filter((m) => m.baseline === "A").length;
    expect(summary.mean_scores.evidence_integrity).toEqual({ baseline: baselineA ? 2 : 1, candidate: baselineA ? 1 : 2 });
    expect(Object.values(summary.by_business_type).reduce((n, g) => n + g.reviewed, 0)).toBe(2);
  });

  it("rejects mismatched and malformed review files and reports incomplete rows", () => {
    const { packet, key } = createHumanReviewPacket(run("baseline", "one"), run("candidate", "two"), allCases, "seed-3");
    packet.reviewer_id = "reviewer-1";
    expect(() => summarizeHumanReview(packet, { ...key, packet_id: "wrong" })).toThrow(/do not match/);
    const changed = structuredClone(packet);
    changed.items[0].answer_a += " edited";
    expect(() => summarizeHumanReview(changed, key)).toThrow(/content changed/);
    expect(() => createHumanReviewPacket(run("baseline", "one"), { ...run("candidate", "two"), rows: [] }, allCases, "seed-3")).toThrow(/same case\/surface/);
    expect(summarizeHumanReview(packet, key)).toMatchObject({ reviewed: 0, incomplete: 2 });
  });
});
