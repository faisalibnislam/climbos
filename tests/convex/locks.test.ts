import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Free-plan locks (owner decision 18 Oct 2026): paid-only features fail with a plain "comes with a package". */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Lock Co" });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

const settings = { enabled: true, mode: "always_ask" as const, channels: [{ channel: "linkedin", postsPerWeek: 2 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 };

describe("free-plan locks", () => {
  beforeEach(() => {
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("free accounts can't turn on autopilot, but can preview one week once", async () => {
    const t = setup();
    const w = await workspace(t, "free-ap@example.com");
    await expect(w.client.mutation(api.autopilot.save, { slug: w.slug, ...settings })).rejects.toThrow(/Autopilot comes with a package/);
    await w.client.mutation(api.autopilot.save, { slug: w.slug, ...settings, enabled: false });
    await w.client.mutation(api.autopilot.previewWeek, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    await expect(w.client.mutation(api.autopilot.previewWeek, { slug: w.slug })).rejects.toThrow(/preview week is used/);
  });

  it("free accounts can't create agent tokens or invite a second person; paid accounts can", async () => {
    const t = setup();
    const w = await workspace(t, "free-team@example.com");
    await expect(w.client.mutation(api.agentTokens.create, { slug: w.slug, name: "Claude", scopes: ["draft"], days: 30 })).rejects.toThrow(/comes with a package/);
    await expect(w.client.mutation(api.settings.invite, { slug: w.slug, email: "mate@example.com", role: "editor" })).rejects.toThrow(/one person/);
    await makePaid(t, w.orgId);
    await w.client.mutation(api.settings.invite, { slug: w.slug, email: "mate@example.com", role: "editor" });
    await expect(w.client.mutation(api.agentTokens.create, { slug: w.slug, name: "Claude", scopes: ["draft"], days: 30 })).resolves.toBeTruthy();
  });
});
