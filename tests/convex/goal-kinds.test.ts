import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("goals with several equal-priority types", () => {
  it("saves every chosen type, keeps the first as kind, and carries step-one answers on the business", async () => {
    const t = setup();
    const owner = await asNewUser(t, "goal-kinds@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Kinds Co" });
    await owner.client.mutation(api.orgs.saveOnboardingIntro, { slug, intro: { goalKinds: ["more_sales", "not_a_kind"], goalStatement: "  Sell more bread.  ", monthlyAdBudget: 250, horizonDays: 30, reviewDay: "Monday" } });
    let state = await owner.client.query(api.orgs.onboardingState, { slug });
    expect(state!.business!.onboardingIntro).toMatchObject({ goalKinds: ["more_sales"], goalStatement: "Sell more bread.", monthlyAdBudget: 250, horizonDays: 30, reviewDay: "Monday" });

    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", kinds: ["more_sales", "more_reach", "more_sales"], statement: "Sell more and be found.", horizonDays: 30, monthlyAdBudget: 250 });
    state = await owner.client.query(api.orgs.onboardingState, { slug });
    expect(state!.goal).toMatchObject({ kind: "more_sales", kinds: ["more_sales", "more_reach"] });

    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "One goal.", horizonDays: 30, monthlyAdBudget: 0 });
    state = await owner.client.query(api.orgs.onboardingState, { slug });
    expect(state!.goal).toMatchObject({ kind: "more_customers", kinds: ["more_customers"] });

    const other = await asNewUser(t, "goal-kinds-other@example.com");
    await expect(other.client.mutation(api.orgs.saveOnboardingIntro, { slug, intro: { goalStatement: "Hijack" } })).rejects.toThrow();
  });
});
