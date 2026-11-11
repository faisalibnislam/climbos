import { describe, expect, it } from "vitest";
import { cycleMilestoneInstruction, cycleProgress, milestoneWindows } from "../../shared/agents/planningCycles";
import { lintFeasibility } from "../../shared/agents/specs";
import { OwnerQuestionSchema, ownerAnswer } from "../../shared/climb/ownerQuestion";
const question = { title: "How much time can you spare?", reason: "This changes how much work to prepare.", kind: "single" as const, options: [{ id: "small", label: "Up to one hour" }, { id: "more", label: "A few hours" }], allowOther: true };
describe("short cycles and friendly questions", () => {
  it("covers each day once without a one-week plan", () => {
    for (const days of [14, 30, 90, 365]) {
      const windows = milestoneWindows(days);
      expect(windows[0].start).toBe(1);
      expect(windows.at(-1)?.end).toBe(days);
      expect(windows.every((w, i) => w.start === (i ? windows[i - 1].end + 1 : 1))).toBe(true);
    }
    expect(milestoneWindows(7)).toEqual([]);
    expect(cycleMilestoneInstruction(14)).toContain("1–7, 8–14");
    expect(cycleProgress(1000, 14, 1000 + 15 * 86400000)).toMatchObject({ day: 14, reviewDue: true });
  });
  it("does not turn uncertainty or a choice into permission", () => {
    expect(ownerAnswer(question, { optionIds: [], notSure: true })).toContain("remains unknown");
    expect(ownerAnswer(question, { optionIds: ["small"], notSure: false })).toContain("not approval");
    expect(() => ownerAnswer(question, { optionIds: ["small", "more"], notSure: false })).toThrow();
    expect(() => ownerAnswer(question, { optionIds: ["alien"], notSure: false })).toThrow();
    expect(() => ownerAnswer(question, { optionIds: ["small"], notSure: true })).toThrow();
    expect(() => ownerAnswer(question, { optionIds: [], notSure: false })).toThrow();
    expect(ownerAnswer({ ...question, kind: "multiple" }, { optionIds: ["small", "more"], notSure: false })).toContain("Up to one hour; A few hours");
    expect(OwnerQuestionSchema.safeParse({ ...question, options: [question.options[0], question.options[0]] }).success).toBe(false);
  });
  it("rejects zero-hour plans that explicitly assign manual work to the owner", () => {
    const play = { name: "Buyer conversations", kind: "bankable", mechanic: "The owner interviews qualified buyers.", model: { monthlySpendUsd: 0, ownerHoursPerWeek: 0 } };
    expect(lintFeasibility([play], { monthlyAdBudgetUsd: 0 }).some((issue) => issue.rule === "capacity" && issue.path === "plays[0].model.ownerHoursPerWeek")).toBe(true);
    expect(lintFeasibility([{ ...play, model: { ...play.model, ownerHoursPerWeek: 1 } }], { monthlyAdBudgetUsd: 0, ownerHoursPerWeek: 1 })).toEqual([]);
    expect(lintFeasibility([{ ...play, mechanic: "AI drafts a reversible page variant for later review." }], { monthlyAdBudgetUsd: 0 })).toEqual([]);
  });

});
