import { v } from "convex/values";
import { z } from "zod";
import { fakeTurn } from "../shared/agents/fake";
import { CALL_ROUTES } from "../shared/agents/routes";
import { runAgent, type AgentDeps } from "../shared/agents/runtime";
import { growthPlaysSpec, playCatalogsFor } from "../shared/agents/specs";
import { modelTurn } from "../shared/ai/turn";
import { currentRateVersion } from "../shared/economics";
import { LAB_CASE } from "../shared/lab/formkitCase";
import { CLIMBOS_ENGINES } from "../shared/agents/capacity";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

const rates = () => currentRateVersion();
const call = () => (process.env.CLIMBOS_FAKE_LLM ? fakeTurn : modelTurn);

/** One arm of a lab test: the growth-plays agent on the Formkit case, scored by its reviewer (1–5 average). */
export const runArm = internalAction({
  args: { id: v.id("engineProposals"), arm: v.union(v.literal("baseline"), v.literal("variant")) },
  handler: async (ctx, { id, arm }): Promise<void> => {
    const p = await ctx.runQuery(internal.engineLab.proposalById, { id });
    if (!p) return;
    const approved: string = await ctx.runQuery(internal.engineLab.addendumFor, { agentId: "growth_plays" });
    const addendum = [approved, arm === "variant" ? p.rules : ""].filter(Boolean).join("\n");
    let cost = 0;
    // Medium effort and one review keep each arm inside one action and ≈$0.15.
    const base = growthPlaysSpec({ maxRevisions: 0, effort: { draft: "medium", critic: "low" } }, playCatalogsFor("saas"));
    const spec = { ...base, addendum: addendum || undefined, maxTokens: { research: 16_000, draft: 20_000, critic: 12_000 } };
    const deps: AgentDeps = {
      turn: async (req) => {
        const r = await call()({ ...req, timeoutMs: 420_000 }, rates());
        cost += r.costMicros;
        return r;
      },
      phase: async (_key, _label, fn) => (await fn()).value,
    };
    try {
      const result = await runAgent(spec, { task: `Choose this business's growth-plays portfolio for the goal. Be ambitious but truthful.\n\n${CLIMBOS_ENGINES}\n\nBUSINESS INTELLIGENCE:\n${LAB_CASE.insights}`, brief: LAB_CASE.brief, facts: LAB_CASE.facts }, deps);
      await ctx.runMutation(internal.engineLab.recordArm, { id, arm, score: result.assessment?.average ?? 0, costMicros: cost });
    } catch (e) {
      await ctx.runMutation(internal.engineLab.recordArm, { id, arm, costMicros: cost, error: (e as Error).message });
    }
    await ctx.runMutation(internal.engineLab.addSpend, { micros: cost });
  },
});

const Proposal = z.object({ rules: z.array(z.string()), rationale: z.string() });

/** Weekly: turn recurring reviewer feedback on real plans into a few candidate rules per agent. */
export const proposeWeekly = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    // Paused (owner, 2026-10-18): feedback is cross-tenant free text and may carry
    // tenant details. Re-enable with ENGINE_LAB_PROPOSALS=on once fixes are redacted.
    if (process.env.ENGINE_LAB_PROPOSALS !== "on") return 0;
    if ((await ctx.runQuery(internal.engineLab.spend, {})) >= 4_800_000) return 0;
    let made = 0;
    for (const agentId of ["growth_plays", "growth_strategy"]) {
      const feedback: string[] = await ctx.runQuery(internal.engineLab.recentFeedback, { agentId });
      if (feedback.length < 6) continue;
      const existing: string = await ctx.runQuery(internal.engineLab.addendumFor, { agentId });
      const r = await call()(
        {
          modelKey: CALL_ROUTES.chat_intent,
          cacheKey: "climbos:engine_lab",
          verbosity: "low",
          system: [{ text: "You improve an AI growth-planning agent. From reviewer feedback on its recent plans, find the 2–5 most recurring weaknesses and write one rule each that would prevent it (max 20 words, imperative, concrete). Skip anything already covered by the approved rules. If nothing recurs, return no rules." }],
          messages: [{ role: "user", content: `APPROVED RULES:\n${existing || "(none)"}\n\nREVIEWER FEEDBACK (recent plans):\n- ${feedback.join("\n- ").slice(0, 12_000)}` }],
          schema: Proposal,
          maxTokens: 2_000,
          effort: "low",
          thinkingOff: true,
        },
        rates(),
      );
      await ctx.runMutation(internal.engineLab.addSpend, { micros: r.costMicros });
      const parsed = r.ok ? Proposal.safeParse(r.output) : null;
      const rules = parsed?.success ? parsed.data.rules.map((x) => x.trim()).filter(Boolean).slice(0, 5) : [];
      if (!rules.length) continue;
      const pid: Id<"engineProposals"> = await ctx.runMutation(internal.engineLab.saveProposal, { agentId, rules: rules.map((x) => `- ${x}`).join("\n"), rationale: parsed?.success ? parsed.data.rationale : "" });
      void pid;
      made++;
    }
    return made;
  },
});
