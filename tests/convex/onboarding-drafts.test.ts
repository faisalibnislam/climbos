import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { draftLabel } from "../../convex/onboardingDrafts";
import { asNewUser, setup } from "./helpers";

const draft = (o: Record<string, unknown> = {}) => JSON.stringify({ version: 1, additional: true, prefillWebsite: "", prefillGoal: "", mode: "chat", chat: "", name: "", nameOverride: null, website: "", noWebsite: false, description: "", ...o });

describe("saved onboarding drafts", () => {
  it("names a draft from what the owner wrote", () => {
    expect(draftLabel(draft({ chat: "My business is called Northstar Bakery. I sell bread." }))).toBe("Northstar Bakery");
    expect(draftLabel(draft({ name: "Formkit" }))).toBe("Formkit");
    expect(draftLabel(draft())).toBe("");
    expect(draftLabel("not json")).toBeNull();
  });

  it("saves, lists and updates a step-one draft for its owner only", async () => {
    const t = setup();
    const owner = await asNewUser(t, "draft-owner@example.com");
    const other = await asNewUser(t, "draft-other@example.com");
    expect(await owner.client.mutation(api.onboardingDrafts.save, { payload: draft() })).toBeNull();
    const id = (await owner.client.mutation(api.onboardingDrafts.save, { payload: draft({ chat: "My business is called Northstar Bakery." }) }))!;
    expect(await owner.client.query(api.onboardingDrafts.mine, {})).toEqual([expect.objectContaining({ id, label: "Northstar Bakery" })]);
    await owner.client.mutation(api.onboardingDrafts.save, { draftId: id, payload: draft({ name: "Northstar Bread Co" }) });
    expect((await owner.client.query(api.onboardingDrafts.get, { draftId: id }))?.label).toBe("Northstar Bread Co");

    expect(await other.client.query(api.onboardingDrafts.get, { draftId: id })).toBeNull();
    expect(await other.client.query(api.onboardingDrafts.mine, {})).toEqual([]);
    await expect(other.client.mutation(api.onboardingDrafts.save, { draftId: id, payload: draft({ name: "Taken" }) })).rejects.toThrow(/isn't available/);
    await other.client.mutation(api.onboardingDrafts.discard, { draftId: id });
    expect(await owner.client.query(api.onboardingDrafts.get, { draftId: id })).not.toBeNull();

    await owner.client.mutation(api.onboardingDrafts.discard, { draftId: id });
    expect(await owner.client.query(api.onboardingDrafts.mine, {})).toEqual([]);
  });

  it("removes a draft the owner clears, and refuses guests", async () => {
    const t = setup();
    const owner = await asNewUser(t, "draft-clear@example.com");
    const id = (await owner.client.mutation(api.onboardingDrafts.save, { payload: draft({ name: "Clear Me" }) }))!;
    expect(await owner.client.mutation(api.onboardingDrafts.save, { draftId: id, payload: draft() })).toBeNull();
    expect(await owner.client.query(api.onboardingDrafts.mine, {})).toEqual([]);
    const guest = await asNewUser(t, "draft-guest@example.com", { anonymous: true });
    await expect(guest.client.mutation(api.onboardingDrafts.save, { payload: draft({ name: "Guest" }) })).rejects.toThrow(/free account/);
  });
});
