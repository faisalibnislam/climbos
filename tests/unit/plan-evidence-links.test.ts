import { describe, expect, it } from "vitest";
import { lintCites } from "../../shared/agents/specs";
import { resolveCites } from "../../shared/agents/evidence";
import { conflictLines, findConflicts } from "../../shared/agents/conflicts";
import { planQuality, agentQuality } from "../../shared/agents/quality";

/** Items 8 and 9 (Book 14 §5): claims link to evidence; conflicting facts are kept and shown. */
describe("channel and audience cites", () => {
  const evidence = "Research notes: pricing at https://formkit.app/pricing/ shows Pro at $19.\nhttps://www.g2.com/products/formkit/reviews";
  const plan = (cites: string[], aud: string[] = []) => ({ channels: [{ name: "SEO pages", priority: 1, cites }], audiences: [{ name: "Solo founders", cites: aud }] });
  it("accepts confirmed facts and pages the research read (any www / slash / query form)", () => {
    expect(lintCites(plan(["fact:0", "fact:2", "https://formkit.app/pricing", "https://g2.com/products/formkit/reviews?x=1"]), 3, evidence)).toEqual([]);
  });
  it("fails a fact index out of range or a page nobody read, as a citation error", () => {
    const issues = lintCites(plan(["fact:3"], ["https://made-up.example/report"]), 3, evidence);
    expect(issues.map((i) => [i.rule, i.path])).toEqual([
      ["citation", "channels[0].cites"],
      ["citation", "audiences[0].cites"],
    ]);
  });
  it("nudges (warn) when the top channel cites nothing", () => {
    expect(lintCites(plan([]), 2, evidence)).toMatchObject([{ severity: "warn", rule: "uncited" }]);
  });
  it("resolves cites to fact ids and titled pages, dropping duplicates and junk", () => {
    const refs = resolveCites(["fact:1", "fact:1", "https://www.formkit.app/pricing/", "https://formkit.app/pricing", "fact:9", "nonsense"], ["f0", "f1"], [{ url: "https://formkit.app/pricing", title: "Pricing" }]);
    expect(refs).toEqual([
      { kind: "fact", factId: "f1" },
      { kind: "web", url: "https://www.formkit.app/pricing/", title: "Pricing" },
    ]);
  });
});

describe("conflicting facts", () => {
  it("flags two prices for one tier and two trial lengths, keeping both", () => {
    const cs = findConflicts([
      { id: "a", statement: "Pro plan costs $19/month", category: "pricing" },
      { id: "b", statement: "Pro is $24 per month, billed monthly", category: "pricing" },
      { id: "c", statement: "14-day free trial on every plan", category: "offer" },
      { id: "d", statement: "Try it free with a 7 day trial", category: "pricing" },
    ]);
    expect(conflictLines(cs)).toEqual(["Pro price per month: $19 vs $24", "Free trial length (days): 14 days vs 7 days"]);
    expect(cs[0].factIds).toEqual(["a", "b"]);
  });
  it("doesn't flag an annual discount, other tiers, other currencies or one fact", () => {
    expect(
      findConflicts([
        { id: "a", statement: "Pro: $19/month or $190/year", category: "pricing" },
        { id: "b", statement: "Starter costs $9/month", category: "pricing" },
        { id: "c", statement: "Pro costs €18/month in Europe", category: "pricing" },
        { id: "d", statement: "Pro $19 per month", category: "pricing" },
        { id: "e", statement: "Team of 12 people, Pro users love it $99/month", category: "team" },
      ]),
    ).toEqual([]);
  });
  it("conflicts are listed on the plan without changing its state", () => {
    const q = planQuality([agentQuality("growth_plays", { critique: { gates: [], scores: [], strengths: [], fixes: [] }, lint: [], average: 4.5, minimum: 4, gatesPassed: true, ship: true }, 1, 3)], [], { conflicts: ["Pro price per month: $19 vs $24"] });
    expect(q.state).toBe("passed");
    expect(q.conflicts).toEqual(["Pro price per month: $19 vs $24"]);
  });
});
