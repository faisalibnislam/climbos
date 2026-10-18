import { describe, expect, it } from "vitest";
import { fitJson, fitText } from "../../shared/agents/context";
import { untracedNumbers } from "../../shared/agents/lint";
import { growthPlaysSpec, ownNumbers } from "../../shared/agents/specs";

describe("fitJson", () => {
  it("returns the full JSON when it fits", () => {
    const v = { plays: [{ a: 1 }, { a: 2 }] };
    expect(fitJson(v, 1000)).toEqual({ text: JSON.stringify(v), dropped: [] });
  });

  it("stays valid JSON and reports what it dropped", () => {
    const v = { plays: Array.from({ length: 20 }, (_, i) => ({ name: `Play ${i}`, why: "x".repeat(200) })), note: "keep" };
    const f = fitJson(v, 1500, "plays");
    expect(f.text.length).toBeLessThanOrEqual(1500);
    const parsed = JSON.parse(f.text);
    expect(parsed.note).toBe("keep");
    expect(parsed.plays[0].name).toBe("Play 0");
    expect(f.dropped.length).toBeGreaterThan(0);
    expect(f.dropped[0]).toMatch(/^plays\.plays\[19\]$/);
  });

  it("shortens long strings when no list can shrink", () => {
    const f = fitJson({ notes: "y".repeat(5000) }, 1000);
    expect(f.text.length).toBeLessThanOrEqual(1000);
    expect(JSON.parse(f.text).notes.endsWith("…")).toBe(true);
    expect(f.dropped[0]).toMatch(/^notes: [\d,]+ chars$/);
  });
});

describe("fitText", () => {
  it("cuts at a line break and says how much is missing", () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i} ${"z".repeat(40)}`).join("\n");
    const f = fitText(text, 1000, "research notes");
    expect(f.text.length).toBeLessThanOrEqual(1000);
    expect(f.text).toMatch(/\n\[[\d,]+ more characters not shown\]$/);
    expect(f.dropped[0]).toMatch(/^research notes: /);
  });

  it("leaves short text alone", () => {
    expect(fitText("short", 100)).toEqual({ text: "short", dropped: [] });
  });
});

describe("plan number tracing", () => {
  it("accepts labelled assumptions, targets and deadlines in plans only", () => {
    const text = "Assume a 4% reply rate. Target 40 paying customers by day 45. Formkit has 21,000 users.";
    expect(untracedNumbers(text, "", { labelled: true })).toEqual(["21,000"]);
    expect(untracedNumbers(text, "")).toEqual(expect.arrayContaining(["4%", "40", "21,000"]));
  });

  it("collects the output's own numbers, rates also as percentages", () => {
    expect(ownNumbers({ model: { weeklyReach: 400, steps: [{ rate: 0.08 }] }, name: "x" })).toEqual(["400", "0.08", "8"]);
  });

  it("traces numbers given in the task (insights, plays, locked numbers)", () => {
    const spec = growthPlaysSpec();
    const out = {
      portfolioNote: "Competitor charges $49 a month, so we undercut it.",
      plays: [],
      economics: { revenuePerCustomerMonthUsd: 20, grossMargin: 0.8, monthsRetained: 12, basis: "pricing page" },
    };
    const base = { brief: "BUSINESS: Test", facts: [], untrustedContext: "" };
    const flagged = (task: string) => spec.lint!(out as never, { ...base, task }).filter((i) => i.rule === "invented_fact" && i.path === "portfolioNote");
    expect(flagged("")).toHaveLength(1);
    expect(flagged("BUSINESS INTELLIGENCE: competitor pricing $49/month")).toHaveLength(0);
  });
});

describe("funnel citations", () => {
  it("accepts only sources the writer actually had", async () => {
    const { lintCitations } = await import("../../shared/agents/specs");
    const plays = [{ funnel: ["500 emails → replies: 1–4% [instantly.ai, B]", "replies → paid: 20% [assumption, grade D]", "visits → trials: 3% [Formkit pricing page, A]"] }];
    expect(lintCitations(plays, "Sources:\nhttps://www.instantly.ai/cold-email-benchmark")).toEqual([]);
    const issues = lintCitations(plays, "no sources");
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("plays[0].funnel[0]");
  });
});
