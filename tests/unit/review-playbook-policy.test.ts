import { expect, it } from "vitest";
import { draftSystem } from "../../shared/agents/runtime";
import { growthPlaysSpec, playCatalogsFor, retentionSpec } from "../../shared/agents/specs";
import { skillPlaybook } from "../../shared/skills";

it.each(["b2b_saas", "ecommerce", "local_service"])("loads neutral unrewarded review guidance in the actual %s writer system", type => {
  const prompt = draftSystem(growthPlaysSpec({}, playCatalogsFor(type))).map(block => block.text).join("\n");
  expect(prompt).toContain("Never offer rewards for reviews, changes, removals or ratings");
  expect(prompt).toContain("tenant, exact content version, destination, audience and action scope");
  expect(prompt).not.toMatch(/G2-approved gift cards|same incentive for any honest review|selects happy users|optional .Enjoying X|no review push under 10 happy|with ≥10 happy active customers|enrol 10–30 units pre-launch/);
});
it("keeps the same review policy in lifecycle advice", () => {
  const prompt = draftSystem(retentionSpec()).map(block => block.text).join("\n");
  expect(prompt).toContain("Never offer rewards for reviews, changes, removals or ratings");
  expect(prompt).not.toContain("No incentives for reviews on platforms that forbid them");
});
it("retains creator/referral options while separating them from rewarded public customer reviews", () => {
  const catalog = skillPlaybook("plays-ecommerce-consumer");
  expect(catalog).toContain("post-purchase-referral");
  expect(catalog).toContain("micro-youtuber-review-outreach");
  expect(catalog).toContain("Sponsored editorial coverage is separate from public customer review collection");
  expect(catalog).not.toContain("free product for honest review, or pay by average views");
});
