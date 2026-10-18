"use node";

import { v } from "convex/values";
import { vapidHeaders } from "../shared/push/vapid";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/** Wake each of the user's devices; their service worker pulls the text. */
export const deliver = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const priv = process.env.VAPID_PRIVATE_JWK;
    const pub = process.env.VAPID_PUBLIC_KEY;
    if (!priv || !pub || process.env.CLIMBOS_FAKE_PUSH) return 0;
    let ok = 0;
    for (const t of await ctx.runQuery(internal.push.targets, { userId })) {
      try {
        const res = await fetch(t.endpoint, { method: "POST", headers: await vapidHeaders(t.endpoint, priv, pub, "mailto:faisalibnislam@gmail.com") });
        await ctx.runMutation(internal.push.markResult, { id: t.id, ok: res.ok, gone: res.status === 404 || res.status === 410 });
        if (res.ok) ok++;
      } catch {
        await ctx.runMutation(internal.push.markResult, { id: t.id, ok: false, gone: false });
      }
    }
    return ok;
  },
});
