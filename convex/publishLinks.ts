"use node";

import { lookup } from "node:dns/promises";
import { v } from "convex/values";
import { checkPublicLinks } from "../shared/integrations/website";
import { internalAction } from "./_generated/server";

const resolveHost = async (hostname: string) => (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

/** Public-link check used only after a social artifact's exact approval has been verified. */
export const check = internalAction({
  args: { urls: v.array(v.string()) },
  handler: async (_ctx, { urls }) => checkPublicLinks(urls, { resolveHost, timeoutMs: 5_000 }),
});
