import { api } from "../../convex/_generated/api";
import { setup, asNewUser } from "../convex/helpers";
import { focusedPlanFixture } from "./focusedPlan";
export async function stepWorkFixture() {
  const t = setup(), owner = await asNewUser(t, "step-work-owner@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Step Work", website: "https://business.example/" });
  const goalId = await owner.client.mutation(api.goals.save, { slug, statement: "Help the right people try the real product" });
  const draft = focusedPlanFixture();
  const strategyId = await t.run(async ctx => {
    const goal = (await ctx.db.get(goalId))!;
    return ctx.db.insert("strategies", { orgId, businessId: goal.businessId, goalId, version: 1, status: "needs_approval", summary: draft.summary, positioning: draft.positioning, audiences: [], channels: [], constraints: [], measurementPlan: draft.measurementPlan, sourceFactIds: [], reviewDate: "2027-02-01", generationCostMicros: 0, createdAt: Date.now(), expert: { version: 0, diagnosis: draft.diagnosis, affordableCac: draft.affordableCac, notDoing: draft.notDoing, northStar: draft.northStar, leadingIndicators: [], phases: draft.phases, weekOneChecklist: draft.weekOneChecklist, risks: draft.risks, focusedMove: draft.focusedMove, preparedWork: draft.preparedWork, timing: draft.timing } });
  });
  return { t, owner, orgId, slug, goalId, strategyId, stepKey: "step-0" };
}
export const usefulStepResult = { summary: "I prepared an introduction you can use on the product page.", drafts: [{ title: "A clearer page introduction", kind: "seo" as const, body: "Bring the details of your next client request into one clear intake. Review the actual request, note what is missing, and use the intake to prepare an informed project discussion. This proposed introduction needs checking against the real product before use." }], evidence: [], ownerQuestion: null, ownerTasks: ["Check the product description before publishing"] };
