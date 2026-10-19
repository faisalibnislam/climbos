import { describe, expect, it } from "vitest";
import { agentQuality, canDriveWork, planQuality } from "../../shared/agents/quality";
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

  it("soft checks alone (wording, untraced numbers) don't fail a plan", () => {
    const q = planQuality([agentQuality("growth_strategy", assessment({ lint: [err("invented_fact"), err("brevity")] }), 2, null)]);
    expect(q.state).toBe("provisional");
    expect(q.hard).toEqual([]);
  });

  it("older plans without a quality record keep their behaviour", () => {
    expect(canDriveWork(undefined)).toBe(true);
  });
});
