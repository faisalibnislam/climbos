import { query } from "./_generated/server";
import { showsApiCost } from "./lib/costDisplay";
import { optionalUser } from "./lib/tenancy";

/** How the signed-in user sees costs: credits (everyone, by default) or real API cost in dollars (operator-enabled users). */
export const myCostDisplay = query({
  args: {},
  handler: async (ctx) => {
    const user = await optionalUser(ctx);
    return { mode: (await showsApiCost(ctx, user?._id)) ? ("usd" as const) : ("credits" as const) };
  },
});
