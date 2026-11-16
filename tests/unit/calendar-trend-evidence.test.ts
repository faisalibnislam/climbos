import { describe, expect, it } from "vitest";
import { socialCalendarSpec, type SocialCalendar } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";

const url = "https://research.example/format";
const evidence = { sourceUrl: url, observationDate: "2026-11-15", observation: "The creator shows a process before revealing its result." };
const slot = { channel: "linkedin", day: 1, pillar: "Explain", purpose: "teach" as const, format: "text" as const, idea: "Adapt a current meme to explain a process", angle: "Make the hidden work visible", hookDraft: "What happens before the handoff?", proof: "Research observation only", callToAction: "Compare your workflow", needsOwner: false, ownerNote: `Source ${url}; freshness unknown` };
const input: AgentInput = { task: "Plan a week", brief: "Synthetic business", facts: [], availableSourceUrls: [url], precomputedResearch: { notes: `TREND SIGNAL 1\nSource URL: ${url}\nObserved date: ${evidence.observationDate}\nObserved signal: ${evidence.observation}`, sources: [{ url }], retrievedAt: Date.parse("2026-11-16T08:00:00Z") } };
const lint = (changed: Record<string, unknown>, context = input) => socialCalendarSpec({ linkedin: 1 }).lint!({ weekTheme: "Useful explanations", pillars: [], slots: [{ ...slot, ...changed }], learningsApplied: [] } as SocialCalendar, context).filter(issue => issue.severity === "error");

describe("calendar trend evidence", () => {
  it("rejects a known URL and an undated note without a matching observation", () => {
    expect(lint({}).some(issue => issue.rule === "trend_evidence")).toBe(true);
  });
  it("accepts a dated source observation from the same research run", () => {
    expect(lint({ trendSourceUrl: url, trendEvidence: evidence })).toEqual([]);
  });
  it.each([
    { trendEvidence: { ...evidence, observation: "Invented audience response" } },
    { trendEvidence: { ...evidence, observationDate: "2026-11-31" } },
    { trendSourceUrl: "https://other.example/" },
  ])("rejects conflicting structured evidence even without trend wording: %j", changed => {
    expect(lint({ idea: "Explain one process", trendSourceUrl: url, trendEvidence: evidence, ...changed }).some(issue => ["trend_evidence", "citation"].includes(issue.rule))).toBe(true);
  });
  it("rejects stale evidence and missing retrieval dates", () => {
    const declared = { trendSourceUrl: url, trendEvidence: evidence };
    expect(lint(declared, { ...input, precomputedResearch: { ...input.precomputedResearch!, retrievedAt: Date.parse("2026-12-20T08:00:00Z") } }).some(issue => issue.rule === "trend_evidence")).toBe(true);
    expect(lint(declared, { ...input, precomputedResearch: { ...input.precomputedResearch!, retrievedAt: undefined } }).some(issue => issue.rule === "trend_evidence")).toBe(true);
  });
  it("keeps genuinely evergreen ideas available without trend research", () => {
    expect(lint({ idea: "Explain one process", ownerNote: "Owner should check the workflow" }, { task: "Plan", brief: "Synthetic", facts: [] })).toEqual([]);
  });
  it.each(["proof", "callToAction"])("requires evidence for a trend reference in %s", field => {
    expect(lint({ idea: "Explain one process", ownerNote: "Owner should check the workflow", [field]: "Try the current viral format" }, { task: "Plan", brief: "Synthetic", facts: [] }).some(issue => issue.rule === "trend_evidence")).toBe(true);
  });
});
