import { describe, expect, it } from "vitest";
import { verifyRecurringRules } from "../../shared/lab/proposalEvidence";

const issue = "The plan recommends paid search without checking the conversion tracking setup.";

describe("engine lab proposal evidence", () => {
  it("counts distinct businesses only when cited text appears verbatim in their feedback", () => {
    const feedback = [
      { business: "B1", fix: issue },
      { business: "B1", fix: "The budget limit was not made clear to the owner." },
      { business: "B2", fix: issue },
      { business: "B3", fix: issue },
      { business: "B4", fix: issue },
      { business: "B5", fix: issue },
    ];
    const proposal = [{ rule: "Check conversion tracking before recommending paid search.", evidence: feedback.map(({ business }) => ({ business, quote: issue })) }];
    expect(verifyRecurringRules(proposal, feedback)).toEqual([{ rule: proposal[0]!.rule, distinctBusinesses: 5 }]);
  });

  it("rejects paraphrases, invented business labels, and duplicate feedback from too few businesses", () => {
    const feedback = [
      { business: "B1", fix: issue },
      { business: "B1", fix: issue },
      { business: "B2", fix: issue },
      { business: "B3", fix: issue },
      { business: "B4", fix: issue },
    ];
    const evidence = ["B1", "B2", "B3", "B4", "B5"].map((business) => ({ business, quote: "The plan uses search ads before checking measurement." }));
    expect(verifyRecurringRules([{ rule: "Check conversion tracking before recommending paid search.", evidence }], feedback)).toEqual([]);
  });

  it("ignores too-short quotations and overly broad or duplicate rules", () => {
    const feedback = Array.from({ length: 5 }, (_, i) => ({ business: `B${i + 1}`, fix: issue }));
    const evidence = feedback.map(({ business }) => ({ business, quote: issue }));
    const proposals = [
      { rule: "Do better.", evidence },
      { rule: "Check conversion tracking before recommending paid search.", evidence: evidence.map(({ business }) => ({ business, quote: "track ads" })) },
      { rule: "Check conversion tracking before recommending paid search.", evidence },
      { rule: "Check conversion tracking before recommending paid search.", evidence },
    ];
    expect(verifyRecurringRules(proposals, feedback)).toEqual([{ rule: proposals[2]!.rule, distinctBusinesses: 5 }]);
  });
});
