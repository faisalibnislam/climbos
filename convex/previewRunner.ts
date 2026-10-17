import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Replaced by the full research runner (see engine/preview.ts).
export const run = internalAction({
  args: { token: v.string() },
  handler: async () => {},
});
