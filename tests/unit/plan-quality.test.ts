import { describe, expect, it } from "vitest";
import { agentQuality, canDriveWork, fixWhere, planQuality, withoutHard } from "../../shared/agents/quality";
import type { Assessment, LintIssue } from "../../shared/agents/types";

/** Frozen S1 regression cases: a completed workflow is not the same as a plan that passed. */
const assessment = (o: Partial<Assessment> & { lint?: LintIssue[] } = {}): Assessment => ({
  critique: { gates: [], scores: [], strengths: [], fixes: [] },
  lint: [],
  average: 4.4,
  minimum: 4,
  gatesPassed: true,
  ship: true,
  ...o,
});
const err = (rule: string): LintIssue => ({ severity: "error", rule, message: rule });

describe("plan quality", () => {
  it("passes only when every agent shipped with no flagged checks", () => {
    const q = planQuality([agentQuality("growth_plays", assessment(), 1, 6), agentQuality("growth_strategy", assessment(), 1, null)]);
    expect(q.state).toBe("passed");
    expect(canDriveWork(q)).toBe(true);
  });

  it("gate exhaustion: the review never signed off → provisional, still inspectable", () => {
    const q = planQuality([agentQuality("growth_plays", assessment({ gatesPassed: false, ship: false, average: 3.1 }), 3, 6)]);
    expect(q.state).toBe("provisional");
    expect(q.reasons[0]).toMatch(/review didn't sign off/);
    expect(canDriveWork(q)).toBe(true);
  });

  it("invalid economics after the last revision → failed; it can't drive work", () => {
    const q = planQuality([agentQuality("growth_plays", assessment({ ship: false, lint: [err("economics"), err("economics"), err("brevity")] }), 3, 6)]);
    expect(q.state).toBe("failed");
    expect(q.hard).toEqual(["growth_plays: economics ×2"]);
    expect(q.reasons[0]).toMatch(/don't add up or it loses money/);
    expect(canDriveWork(q)).toBe(false);
  });

  it("a bare channel category is a hard failure and cannot be approved to drive work", () => {
    const q = planQuality([agentQuality("growth_plays", assessment({ lint: [err("generic_action")] }), 2, 6)]);
    expect(q.state).toBe("failed");
    expect(q.hard).toEqual(["growth_plays: generic_action ×1"]);
    expect(canDriveWork(q)).toBe(false);
  });

  it("a hard finding on the final plan (after the consistency pass) also fails it", () => {
    const q = planQuality([agentQuality("growth_strategy", assessment(), 1, null)], [err("consistency")]);
    expect(q.state).toBe("failed");
    expect(q.hard).toEqual(["final: consistency"]);
  });

  it("missing customer economics → needs_input", () => {
    expect(planQuality([agentQuality("growth_plays", assessment(), 1, 4)], [], { economicsMissing: true }).state).toBe("needs_input");
  });

  it("partial research (no sources) → provisional with the reason", () => {
    const q = planQuality([agentQuality("growth_plays", assessment(), 1, 0)]);
    expect(q.state).toBe("provisional");
    expect(q.reasons.join(" ")).toMatch(/no sources/);
  });

  it("soft checks alone (wording) don't fail a plan", () => {
    const q = planQuality([agentQuality("growth_strategy", assessment({ lint: [err("brevity"), err("generic")] }), 2, null)]);
    expect(q.state).toBe("provisional");
    expect(q.hard).toEqual([]);
  });

  it("a number with no source or label fails the plan and says where (Book 14 §13)", () => {
    const lint: LintIssue[] = [{ severity: "error", rule: "invented_fact", message: "Numbers not found in the inputs, facts or research: 37%.", path: "phases[1].focus" }];
    const q = planQuality([agentQuality("growth_strategy", assessment({ lint }), 2, null)]);
    expect(q.state).toBe("failed");
    expect(canDriveWork(q)).toBe(false);
    expect(q.reasons.join(" ")).toMatch(/no source/);
    expect(q.fixes).toEqual([{ rule: "invented_fact", path: "phases[1].focus", message: lint[0].message }]);
    expect(fixWhere(q.fixes![0].path)).toBe("Phases 2");
    expect(fixWhere("summary")).toBe("Summary");
    expect(fixWhere(undefined)).toBe("Plan");
  });

  it("hard findings fixed by a later pass don't count twice: withoutHard keeps only soft errors", () => {
    const a = agentQuality("growth_strategy", assessment({ lint: [err("invented_fact"), err("consistency"), err("brevity")] }), 2, null);
    const stripped = withoutHard(a);
    expect(stripped.errors).toEqual({ brevity: 1 });
    expect(stripped.fixes).toBeUndefined();
    expect(planQuality([stripped]).state).toBe("provisional");
    // The final lint still decides: a remaining hard finding fails the plan.
    expect(planQuality([stripped], [{ severity: "error", rule: "consistency", message: "x", path: "summary" }]).state).toBe("failed");
  });

  it("unknown inputs are listed without changing the state", () => {
    const q = planQuality([agentQuality("growth_plays", assessment(), 1, 6)], [], { unknowns: ["Hours you can give growth work each week"] });
    expect(q.state).toBe("passed");
    expect(q.unknowns).toEqual(["Hours you can give growth work each week"]);
  });

  it("older plans without a quality record keep their behaviour", () => {
    expect(canDriveWork(undefined)).toBe(true);
  });
});
