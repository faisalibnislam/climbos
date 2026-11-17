"use node";

import { lookup } from "node:dns/promises";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { decryptSecret } from "./lib/crypto";
import { validateResearchUrl, validateResolvedAddresses } from "../shared/integrations/website";
import { signWebhook } from "../shared/webhooks";

/** Bound DNS work separately from the HTTP request. No redirects are followed. */
async function publicDestination(url: string) {
  const checked = validateResearchUrl(url);
  if (!checked.ok || new URL(checked.url).protocol !== "https:") return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([
      lookup(checked.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS timeout")), 3000); }),
    ]);
    return validateResolvedAddresses(records.map(r => r.address)).ok;
  } finally { if (timer) clearTimeout(timer); }
}

export const deliverDue = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const claimed = await ctx.runMutation(internal.webhooks.claimDue, {});
    let attempted = 0;
    // Five concurrent bounded requests; the last batch still fits the two-minute lease under normal timeouts.
    for (let i = 0; i < claimed.length; i += 5) await Promise.all(claimed.slice(i, i + 5).map(async d => {
      let code: number | undefined, error: string | undefined;
      let ok = false, requestStarted = false;
      try {
        const fixture = Boolean(process.env.CLIMBOS_FAKE_WEBHOOKS);
        if (!fixture && !await publicDestination(d.url)) {
          error = "The destination did not resolve exclusively to public addresses. No request started.";
        } else {
          const allowed = await ctx.runMutation(internal.webhooks.authorizeDispatch, d);
          if (!allowed) return;
          if (fixture) { code = 200; ok = true; }
          else {
            const secret = await decryptSecret(allowed.secret, `climbos:${allowed.orgId}:webhook`);
            const ts = Math.floor(Date.now() / 1000);
            requestStarted = true;
            const res = await fetch(allowed.url, {
              method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "ClimbOS-Webhooks/1.0", "X-ClimbOS-Delivery-Id": String(d.id), "X-ClimbOS-Timestamp": String(ts), "X-ClimbOS-Signature": `v1=${await signWebhook(secret, ts, allowed.payload)}` },
              body: allowed.payload, signal: AbortSignal.timeout(10_000), redirect: "manual",
            });
            code = res.status; ok = code >= 200 && code < 300;
            await res.body?.cancel();
          }
        }
      } catch { error = requestStarted ? "The attempt could not confirm receipt. Check the destination before assuming no action happened." : "Destination preparation failed. No request started."; }
      await ctx.runMutation(internal.webhooks.record, { id: d.id, claimToken: d.claimToken, code, ok, error });
      attempted++;
    }));
    return attempted;
  },
});
