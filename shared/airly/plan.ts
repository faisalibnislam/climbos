/** Turn a saved growth plan into a Folevi note (markdown) and Taskeni tasks. Pure. */
export interface PlanLike {
  summary: string;
  positioning: string;
  channels: { name: string; why: string; status: string; deliverables: string[]; measurement: string }[];
  measurementPlan: string;
  expert?: { diagnosis: string; northStar: { metric: string; baseline: string; target: string }; phases: { name: string; days: string; focus: string }[]; weekOneChecklist: string[]; risks: { risk: string; mitigation: string }[] } | null;
}

export function planMarkdown(p: PlanLike, businessName: string): string {
  const e = p.expert;
  const lines = [
    `**${businessName}: 90-day growth plan** (from ClimbOS)`,
    "",
    p.summary,
    "",
    "## Positioning",
    p.positioning,
    "",
    "## Channels",
    ...p.channels.filter((c) => c.status !== "parked").map((c) => `- **${c.name}**: ${c.why}${c.deliverables.length ? `\n  - Deliverables: ${c.deliverables.join("; ")}` : ""}\n  - Measure: ${c.measurement}`),
  ];
  if (e) {
    lines.push("", "## North Star", `${e.northStar.metric}: ${e.northStar.baseline} → ${e.northStar.target}`);
    if (e.phases.length) lines.push("", "## Phases", ...e.phases.map((ph) => `- **${ph.name}** (${ph.days}): ${ph.focus}`));
    if (e.weekOneChecklist.length) lines.push("", "## Week one", ...e.weekOneChecklist.map((t) => `- [ ] ${t}`));
    if (e.risks.length) lines.push("", "## Risks", ...e.risks.map((r) => `- ${r.risk}: ${r.mitigation}`));
  }
  lines.push("", "## Measurement", p.measurementPlan);
  return lines.join("\n").slice(0, 95_000);
}

/** The plan's to-dos for a task board: week-one checklist first, then each active channel's deliverables. */
export function planTasks(p: PlanLike): { title: string; description: string }[] {
  const out: { title: string; description: string }[] = [];
  for (const t of p.expert?.weekOneChecklist ?? []) out.push({ title: t.slice(0, 200), description: "Week one, from your ClimbOS growth plan." });
  for (const c of p.channels.filter((c) => c.status === "active")) for (const d of c.deliverables.slice(0, 3)) out.push({ title: `${c.name}: ${d}`.slice(0, 200), description: `${c.why}\n\nMeasure: ${c.measurement}`.slice(0, 2000) });
  return out.slice(0, 15);
}
