import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { audit } from "./lib/audit";

/** Engine flags a workspace can be opted into while the new behaviour is evaluated (REQ-ENG-01). */
export const ENGINE_FLAGS = ["decision_contract", "plan_targets", "fast_review", "lean_plan"] as const;

/** Staff only (internal, run from the Convex CLI or dashboard): opt a workspace in or out of an engine flag. */
export const setEngineFlag = internalMutation({
  args: { orgId: v.id("organizations"), flag: v.string(), on: v.boolean() },
  handler: async (ctx, { orgId, flag, on }) => {
    if (!(ENGINE_FLAGS as readonly string[]).includes(flag)) throw new Error(`Unknown engine flag: ${flag}`);
    const org = await ctx.db.get(orgId);
    if (!org) throw new Error("Workspace not found");
    const flags = new Set(org.engineFlags ?? []);
    if (on) flags.add(flag);
    else flags.delete(flag);
    await ctx.db.patch(orgId, { engineFlags: [...flags] });
    await audit(ctx, { orgId, actorType: "system", action: "engine.flag", summary: `Engine flag ${flag} ${on ? "on" : "off"}.` });
    return [...flags];
  },
});
