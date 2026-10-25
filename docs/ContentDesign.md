# Content design: scannable by default

Owners don't read long text. Every screen turns continuous text into **scannable content**: visual hierarchy, grouping and progressive disclosure. Live examples: `/design-system/v2/patterns/content`. Owner guidance, 2026-10-19.

## Rules

- **Semantic chunking first.** Find the ideas (problem, benefit, step, risk, number, outcome) and give each its own visual group. Don't just split every few sentences.
- **Choose the format by meaning**, not one layout everywhere. Don't turn everything into cards or bullets.
- **Essentials visible, details on demand.** Show the takeaway; put explanations behind "More", an accordion or a tooltip.
- **Never invent or drop facts.** Restructure and shorten; numbers, costs, risks and warnings stay.
- **Accessible:** semantic HTML (lists are `ul`/`ol`, terms are `dl`), WCAG AA contrast, works at 375px.

## Choosing the format

| Content | Use | Component |
|---|---|---|
| AI prose (plans, answers, notes) | Bullets with bold lead-ins, first 3 shown | `Scannable` / `ProseBullets` |
| Labelled facts ("Budget: $500") | Definition list / fact tiles | `Scannable` (auto), `DescriptionList`, `KeyValueList` |
| Instructions, sequences | Numbered steps | `StepFlow`, `Scannable` (auto for "First…/Then…") |
| Chronology, phases | Timeline | `TimelineView`, `GanttChart` |
| Key numbers | Stat blocks, charts | `StatBlocks`, `@/components/analytics` |
| Comparisons | Table, side by side, before/after | `DataComparison`, `Table` |
| Most important points | Key takeaways | `KeyTakeaways` |
| Notes, warnings, tips | Callout | `Callout` |
| Secondary detail | Accordion, "More" | `Accordion`, `CollapsibleSection`, `Scannable max` |
| Views of one thing | Tabs | `Tabs` |
| FAQs | Q&A accordion | `Accordion` |
| Features, options | Cards, icon lists, grids | `Card`, `IconTile` |

## Typography and spacing

| Element | Rule |
|---|---|
| Paragraph | 1–3 sentences; one idea each |
| Bullet | 1–2 lines; bold the lead-in or key number only |
| Line length | ≤ 70ch for prose (`max-w-[70ch]`) |
| Line height | Prose 1.6 (`leading-relaxed`); UI text keeps the scale |
| Headings | More space above than below; sentence case |
| Bold | Phrases and numbers, never whole paragraphs |
| Columns | 2–3 for short blocks; one column for prose |

## Writing

- Lead with the answer. Labels and buttons are 1–2 words.
- Lead-in labels: "**Budget:** $500/month".
- Numbers as numerals with units: "4 h/week", "$31 per customer".

## People without business training

- Start with the owner's task and one useful next step. Do not assume familiarity with marketing, finance, or software terminology.
- Use everyday labels such as Customer progress instead of Pipeline. Explain necessary terms the first time; retain precise source labels, units, and uncertainty.
- Keep technical controls discoverable under More options or Advanced tools. Costs, permissions, and approval consequences remain visible where the decision happens.
- Suggestions fill an editable draft. Navigation and search do not silently dispatch AI work.
- Follow [App experience](AppExperience.md) for the implemented navigation, shared composer, onboarding, and glossary behavior.
