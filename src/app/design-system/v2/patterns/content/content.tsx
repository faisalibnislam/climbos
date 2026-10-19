"use client";

import { BarChart3, CalendarDays, Columns3, FileText, Layers, List, ListChecks, MousePointerClick } from "@/components/icons";
import { Callout, Table, TableFrame, TBody, Td, Th, THead, Tr, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { Accordion } from "@/components/ds/containers/layout";
import { DataComparison } from "@/components/ds/data/display";
import { TimelineView } from "@/components/ds/data/views";
import { KeyTakeaways, Scannable, StatBlocks, StepFlow } from "@/components/ds/content";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

const FLAT =
  "Test three selected plays: permissioned customer referrals, one WordPress comparison page, and capped WordPress-intent search. The play maths is not a forecast: reach, conversion, gross profit and retention are unverified. Do not scale until actual cost per customer is below $31. Search is capped at $50 total for the first test.";

const TECHNIQUES: { group: string; icon: typeof List; items: [string, string][] }[] = [
  {
    group: "Text structure",
    icon: List,
    items: [
      ["Short paragraphs", "2–3 sentences, one idea each."],
      ["Headings", "Meaningful section titles."],
      ["Subheadings", "Hierarchy inside a section."],
      ["Bullets", "Related statements as a list."],
      ["Numbered lists", "Steps and sequences."],
      ["Bold key phrases", "The phrase, never the paragraph."],
      ["Highlight keywords", "Numbers and terms that matter."],
      ["Lead-in labels", "“Budget: $500/month”."],
      ["Shorter sentences", "Cut words that don't carry meaning."],
      ["One idea per block", "Semantic chunks, not length."],
    ],
  },
  {
    group: "Visual layout",
    icon: Columns3,
    items: [
      ["Cards", "Separate, comparable items."],
      ["Two columns", "Related content side by side."],
      ["Grids", "Many items, consistent rows."],
      ["Tables", "Comparisons and specs."],
      ["Icons + text", "Faster scanning."],
      ["Dividers", "Distinct groups."],
      ["Whitespace", "Space between unrelated ideas."],
      ["Type hierarchy", "Size and weight show importance."],
      ["Callouts", "Notes, warnings, tips."],
      ["Stat blocks", "Numbers as the headline."],
    ],
  },
  {
    group: "Advanced",
    icon: Layers,
    items: [
      ["Accordions", "Details on demand."],
      ["Tabs", "Switchable views of one thing."],
      ["Timelines", "Chronology at a glance."],
      ["Step flows", "Clear stages."],
      ["Comparison", "Before/after, side by side."],
      ["Q&A", "Explanations as questions."],
      ["Key takeaways", "The few points that matter."],
      ["Progressive disclosure", "Essentials first."],
      ["Diagrams", "Processes and relationships."],
      ["Infographics", "Text, icons and data together."],
    ],
  },
];

const FORMATS: [string, string, string][] = [
  ["AI prose", "Bullets, bold lead-ins, first 3 shown", "Scannable"],
  ["Labelled facts", "Definition list or fact tiles", "Scannable (auto), DescriptionList"],
  ["Instructions", "Numbered steps", "StepFlow, Scannable (auto)"],
  ["Phases, history", "Timeline", "TimelineView, GanttChart"],
  ["Key numbers", "Stat blocks, charts", "StatBlocks, analytics"],
  ["Comparisons", "Table, side by side", "DataComparison, Table"],
  ["Most important points", "Key takeaways", "KeyTakeaways"],
  ["Warnings, tips", "Callout", "Callout"],
  ["Secondary detail", "Accordion or “More”", "Accordion, Scannable max"],
  ["FAQs", "Q&A accordion", "Accordion"],
];

const RULES: [string, string][] = [
  ["Paragraph", "1–3 sentences, one idea"],
  ["Bullet", "1–2 lines; bold the lead-in or number"],
  ["Line length", "≤ 70 characters for prose"],
  ["Line height", "1.6 for prose"],
  ["Headings", "More space above than below"],
  ["Bold", "Phrases and numbers only"],
  ["Columns", "2–3 for short blocks"],
  ["Contrast", "WCAG AA (4.5:1) or better"],
];

export function ContentPatterns() {
  return (
    <DocPage eyebrow="Patterns" title="Content" intro="People scan. Turn flat text into structure: hierarchy, grouping and details on demand.">
      <Specimen title="Before and after" description="The same plan summary: one paragraph vs. Scannable.">
        <div className="grid gap-3 md:grid-cols-2">
          <Stage tone="white" label="Before">
            <p className="text-sm text-ink-2">{FLAT}</p>
          </Stage>
          <Stage tone="white" label="After">
            <Scannable text={FLAT} max={4} />
          </Stage>
        </div>
        <Spec items={[["Component", "Scannable (src/components/ds/content)"], ["Picks", "bullets · steps · facts from the text"], ["Bold", "lead-ins and key numbers"]]} />
      </Specimen>

      <Specimen title="Bullets with lead-ins">
        <Stage tone="white">
          <Scannable text={"Reach: 21,000 paying subscribers, permission unknown. Hook: a neutral, incentive-free referral ask. Risk: no lawful channel confirmed yet. Next: verify the channel by day 3."} shape="bullets" max={4} />
        </Stage>
      </Specimen>

      <Specimen title="Numbered steps">
        <Stage tone="white">
          <Scannable text={"First, audit 90 days of paid sign-ups by source. Then verify the customer channel and suppression rules. Next, set up UTMs and the weekly scorecard. Finally, publish the WordPress page."} max={4} />
        </Stage>
      </Specimen>

      <Specimen title="Labelled facts">
        <Stage tone="white">
          <Scannable text={"Ad budget: $500/month, search capped at $50 for the first test. Owner time: 4 hours a week. Price: from $9/month. Margin: 85%, assumed."} max={4} />
        </Stage>
      </Specimen>

      <Specimen title="Key numbers" description="Money, percentages and counts with units are bolded automatically.">
        <Stage tone="white">
          <Scannable text={"Each customer costs $31 and is worth $78 a year. Payback is 4.3 months at 85% margin."} />
        </Stage>
      </Specimen>

      <Specimen title="Key takeaways">
        <KeyTakeaways items={["Test referrals first: lowest cost per customer.", "Cap search at $50 until tracking works.", "Scale only when cost per customer is under $31."]} />
      </Specimen>

      <Specimen title="Stat blocks">
        <StatBlocks
          stats={[
            { label: "Cost per customer", value: "$31", tone: "good", hint: "Ceiling $31" },
            { label: "Worth a year", value: "$78" },
            { label: "Payback", value: "4.3 mo", tone: "warn", hint: "Assumed margin" },
            { label: "Expected in 90 days", value: "16", hint: "Range 3–47" },
          ]}
        />
      </Specimen>

      <Specimen title="Step flow">
        <StepFlow
          steps={[
            { title: "Connect", body: "Link your accounts.", done: true },
            { title: "Plan", body: "Your team drafts the plan." },
            { title: "Approve", body: "Nothing runs without you." },
            { title: "Measure", body: "Results by source." },
          ]}
        />
      </Specimen>

      <Specimen title="Timeline">
        <Stage tone="white">
          <TimelineView
            items={[
              { id: "a", time: "Days 0–14", title: "Foundation", body: "Permissions, tracking, the WordPress page.", state: "done" },
              { id: "b", time: "Days 15–45", title: "Test", body: "Referral pilot and capped search.", state: "current" },
              { id: "c", time: "Days 46–90", title: "Commit", body: "Scale the play that pays back.", state: "upcoming" },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="Comparison">
        <DataComparison
          labels={["Last month", "This month"]}
          rows={[
            { label: "Sign-ups", a: 120, b: 158 },
            { label: "Cost per customer", a: 44, b: 31, higherIsBetter: false, format: (n) => `$${n}` },
          ]}
        />
      </Specimen>

      <Specimen title="Callouts">
        <div className="grid gap-3 md:grid-cols-2">
          <Callout tone="warning" title="Reach not confirmed">
            Verify the channel before sending.
          </Callout>
          <Callout tone="success" title="Tracking is live">
            Sign-ups now carry their source.
          </Callout>
        </div>
      </Specimen>

      <Specimen title="Q&A">
        <Accordion
          items={[
            { id: "q1", title: "Does approving the plan spend money?", content: <p className="text-sm text-ink-2">No. Each post, email and ad still needs its own approval.</p> },
            { id: "q2", title: "Who pays for ads?", content: <p className="text-sm text-ink-2">You pay Google or Meta directly; ClimbOS never holds ad money.</p> },
          ]}
        />
      </Specimen>

      <Specimen title="Progressive disclosure" description="Show the first items; the rest stays one click away.">
        <Stage tone="white">
          <Scannable text={FLAT + " Owner time is about 4 hours a week. Review search terms weekly."} max={2} />
        </Stage>
      </Specimen>

      <Specimen title="30 techniques">
        <Tabs defaultValue={TECHNIQUES[0].group}>
          <TabsList>
            {TECHNIQUES.map((g) => (
              <TabsTrigger key={g.group} value={g.group}>
                {g.group}
              </TabsTrigger>
            ))}
          </TabsList>
          {TECHNIQUES.map((g, gi) => (
            <TabsContent key={g.group} value={g.group} className="mt-4">
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {g.items.map(([t, d], i) => (
                  <li key={t} className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--card-shadow)]">
                    <span className="flex items-center gap-1.5 text-xs tabular-nums text-ink-3">
                      <g.icon aria-hidden className="size-3.5" /> {gi * 10 + i + 1}
                    </span>
                    <span className="text-sm font-semibold text-ink">{t}</span>
                    <span className="text-xs text-ink-2">{d}</span>
                  </li>
                ))}
              </ol>
            </TabsContent>
          ))}
        </Tabs>
      </Specimen>

      <Specimen title="Choosing the format" description="Pick by meaning, not habit. Don't turn everything into cards or bullets.">
        <TableFrame>
          <Table>
            <THead>
              <Tr>
                <Th>Content</Th>
                <Th>Use</Th>
                <Th>Component</Th>
              </Tr>
            </THead>
            <TBody>
              {FORMATS.map(([c, u, k]) => (
                <Tr key={c}>
                  <Td className="font-medium">{c}</Td>
                  <Td>{u}</Td>
                  <Td className="font-mono text-xs text-ink-2">{k}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableFrame>
      </Specimen>

      <Specimen title="Readability rules">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {RULES.map(([k, v], i) => {
            const Icon = [FileText, ListChecks, Columns3, BarChart3, Layers, MousePointerClick, CalendarDays, ListChecks][i] ?? FileText;
            return (
              <div key={k} className="flex gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--card-shadow)]">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" />
                <span>
                  <span className="block text-ui font-semibold text-ink">{k}</span>
                  <span className="block text-xs text-ink-2">{v}</span>
                </span>
              </div>
            );
          })}
        </div>
      </Specimen>
    </DocPage>
  );
}
