import type { Rubric } from "../agents/types";
import { SKILLS } from "./generated";

/** Playbook text (procedure + references + examples) for a skill in skills/. */
export function skillPlaybook(id: string): string {
  const s = SKILLS[id];
  if (!s) throw new Error(`Unknown skill "${id}". Add skills/${id}/SKILL.md and run pnpm skills:build.`);
  return `# Skill: ${s.name}\n\n${s.playbook}`;
}

/** The skill's structured reviewer rubric (skills/<id>/rubric.json). */
export function skillRubric(id: string): Rubric {
  const s = SKILLS[id];
  if (!s) throw new Error(`Unknown skill "${id}".`);
  return s.rubric;
}

/** A skill's rubric as reviewer-readable text (used as an extra checklist for critics). */
export function skillRubricText(id: string): string {
  const r = skillRubric(id);
  return `## ${r.title}\n${r.criteria.map((c) => `- ${c.name}: a 5 means ${c.anchors[5]}`).join("\n")}`;
}

export function skillVersion(id: string): string {
  return SKILLS[id]?.hash ?? "missing";
}

export function listSkills() {
  return Object.values(SKILLS).map(({ name, description, hash }) => ({ name, description, hash }));
}
