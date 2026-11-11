import { expect, it } from "vitest";
import { planTimeline, timelineProgress } from "../../shared/agents/planTimeline";

it("uses the saved step order, variable task counts and timing without inventing extra work", () => {
  const phases = [{ name: "Understand the offer", days: "1–2", focus: "Read the offer.", tasks: ["Read the offer"] }, { name: "Prepare the test", days: "3–8", focus: "Prepare useful work.", tasks: ["Draft the page", "Record the demonstration"] }];
  const steps = planTimeline({ phases, weekOneChecklist: ["Do not duplicate this old checklist"] });
  expect(steps.map(step => [step.title, step.days, step.tasks.length])).toEqual([["Understand the offer", "1–2", 1], ["Prepare the test", "3–8", 2]]);
  expect(steps[0].tasks[0].text).toBe("Read the offer");
});
it("keeps legacy actions and deduplicates their checklist, without treating a prepared draft as done", () => {
  const steps = planTimeline({ phases: [{ name: "Prepare", days: "1–3", focus: "Use the real offer", firstAction: "Review the draft." }], weekOneChecklist: ["Review the draft", "Check the public claims"] });
  expect(steps[0].tasks).toHaveLength(2);
  expect(timelineProgress(steps, []).completed).toBe(0);
  expect(timelineProgress(steps, [{ taskKey: "0:0", taskText: "An older task", completed: true, revision: 1 }]).isDone(steps[0].tasks[0])).toBe(false);
  expect(timelineProgress(steps, steps[0].tasks.map(task => ({ taskKey: task.key, taskText: task.text, completed: true, revision: 1 })))).toMatchObject({ completed: 1, current: -1 });
  expect(planTimeline(null)).toEqual([]);
});
