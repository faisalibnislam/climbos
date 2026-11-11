import { expect, it } from "vitest";
import { lintRefusedOutreach, productPitchRefusal } from "../../shared/agents/contactPolicy";
import { planQuality, canDriveWork } from "../../shared/agents/quality";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { focusedStrategySpec } from "../../shared/agents/specs";
it("distinguishes an explicit refusal of product outreach from a paid-ad-only refusal", () => {
  expect(productPitchRefusal("MacMost does not accept advertising, paid posts, free products for review, or any kind of marketing partnerships.")?.status).toBe("refused");
  expect(productPitchRefusal("DO NOT ask me to look at, review, or link to your product.")?.status).toBe("refused");
  expect(productPitchRefusal("We do not accept paid posts. Independent editorial suggestions are considered.")).toBeUndefined();
  expect(productPitchRefusal("A public contact address is listed.")).toBeUndefined();
});
it("blocks an earned pitch to a refusing target, rather than routing around its contact rules", () => {
  const input = { task: "Prepare", brief: "Realistic source-policy regression", facts: [], precomputedResearch: { notes: "First-party contact page read", sources: [{ url: "https://macmost.com/contact", productPitchPolicy: { status: "refused" as const, evidence: "No marketing partnerships or free products for review." } }] } };
  const work = [{ kind: "creator_pitch", target: "MacMost — topic suggestion form", draft: "Please feature our free Mac app as an independent editorial suggestion." }];
  const issues = lintRefusedOutreach(work, input);
  expect(issues).toContainEqual(expect.objectContaining({ rule: "contact_policy", severity: "error" }));
  expect(canDriveWork(planQuality([], issues))).toBe(false);
  expect(lintRefusedOutreach([{ ...work[0], target: "Another creator, policy unknown" }], input)).toEqual([]);
  expect(lintRefusedOutreach([{ kind: "social_post", target: "Our own YouTube channel", draft: "A proposed task demonstration." }], input)).toEqual([]);
  const plan = focusedPlanFixture(); plan.preparedWork[0] = { ...plan.preparedWork[0], ...work[0], kind: "creator_pitch" };
  expect(focusedStrategySpec().lint?.(plan, input)).toContainEqual(expect.objectContaining({ rule: "contact_policy" }));
});
