# ClimbOS skills

Expert playbooks loaded by the Engine v2 agents (see docs/EngineV2.md). One folder per skill:

```
skills/<id>/
  SKILL.md       required. YAML frontmatter: name (= folder id, lowercase-hyphen, ≤64 chars), description (what it's for + when to use it, ≤1024 chars). Body: the playbook.
  rubric.json    required. The reviewer's rubric (structure below).
  examples.md    recommended. Short good vs bad examples for a fictional business.
  reference/*.md optional. Limits tables, banned phrases, frameworks (appended to the playbook).
```

`pnpm skills:build` compiles everything into `shared/skills/generated.ts`. `pnpm skills:publish` syncs the folders to the Anthropic Skills API.

## SKILL.md body: required sections

1. `## Purpose`: one paragraph. What great looks like for this work.
2. `## Inputs you will get`: what's in the brief (confirmed facts, positioning, goal, brand voice, research notes) and what to do when something is missing (write around it or `[NEEDS FACT: …]`; never invent).
3. `## Procedure`: numbered, concrete steps an expert follows, including the thinking steps (pick angle, choose hook, etc.).
4. `## Quality bar`: the specific traits that separate expert work from mediocre, each testable.
5. `## Never do`: failure modes and banned patterns for this kind of work.
6. `## Checklist before answering`: 6–12 checkbox lines the agent runs on its own output.

Write instructions to the agent in the second person ("you"). Be specific: numbers, limits, structures, decision rules. No fluff. Target 900–2,500 words for SKILL.md plus references. Cite nothing inline (the research docs hold sources), but never state a number you can't back from the research.

## rubric.json

```json
{
  "id": "linkedin-posts",
  "title": "LinkedIn post (founder or company page)",
  "gates": [
    { "id": "G1", "text": "Truth: no claim, number, customer, quote or result that isn't in confirmed facts or cited research." }
  ],
  "criteria": [
    { "id": "C1", "name": "Hook", "anchors": { "1": "...", "3": "...", "5": "..." } }
  ],
  "shipRule": { "minEach": 3, "minAverage": 4 }
}
```

- 3–6 gates. Always include the truth gate as G1. Add format/limit gates and policy gates where relevant.
- 6–10 criteria with crisp anchors for 1, 3 and 5 that a reviewer can apply without guessing.
