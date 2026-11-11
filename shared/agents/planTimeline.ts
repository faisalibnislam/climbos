export type TimelinePhase = { name: string; days: string; focus: string; firstAction?: string; tasks?: string[]; howToCheck?: string; decisionRule?: string };
export type TimelineTask = { key: string; text: string };
export type TimelineStep = { key: string; title: string; days: string; description: string; tasks: TimelineTask[]; startingPoint?: string; check?: string; next?: string };

/** Present saved work in its original order; do not invent actions or calendar windows. */
export function planTimeline(expert?: { phases?: TimelinePhase[]; weekOneChecklist?: string[] } | null): TimelineStep[] {
  return (expert?.phases ?? []).map((phase, index) => {
    const checklist = index === 0 ? expert?.weekOneChecklist ?? [] : [];
    const raw = phase.tasks?.length ? phase.tasks : checklist.length ? checklist : [phase.firstAction];
    const texts = [...new Map(raw.filter((text): text is string => Boolean(text?.trim())).map(text => [text.trim().toLowerCase().replace(/[.!]+$/, ""), text.trim()])).values()];
    // Older plans sometimes contain only a phase focus; retain the actual saved instruction.
    if (!texts.length && phase.focus.trim()) texts.push(phase.focus.trim());
    return { key: `step-${index}`, title: phase.name.replace(/next (?:planning )?cycle/gi, "next steps"), days: phase.days, description: phase.focus, tasks: texts.map((text, task) => ({ key: `${index}:${task}`, text })), startingPoint: phase.firstAction, check: phase.howToCheck, next: phase.decisionRule };
  });
}

export type TaskProgress = { taskKey: string; taskText: string; completed: boolean; revision: number };
export function timelineProgress(steps: TimelineStep[], saved: TaskProgress[]) {
  const isDone = (task: TimelineTask) => saved.some(row => row.taskKey === task.key && row.taskText === task.text && row.completed);
  const done = steps.map(step => step.tasks.length > 0 && step.tasks.every(isDone));
  return { isDone, done, completed: done.filter(Boolean).length, current: done.findIndex(value => !value) };
}
