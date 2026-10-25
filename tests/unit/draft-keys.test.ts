import { describe, expect, it } from "vitest";
import { askDraftKey, onboardingDraftKey, parseOnboardingDraft, wishDraftKey } from "../../src/components/app/draftKeys";

describe("owner request draft keys", () => {
  it("keeps one-time command handoffs separate from saved Home drafts", () => {
    expect(askDraftKey("studio", "user-1")).not.toBe(wishDraftKey("studio", "user-1"));
  });

  it("isolates saved drafts by both workspace and signed-in person", () => {
    const key = wishDraftKey("studio", "user-1");
    expect(wishDraftKey("studio", "user-2")).not.toBe(key);
    expect(wishDraftKey("shop", "user-1")).not.toBe(key);
  });

  it("separates first-business and additional-business setup by person", () => {
    expect(onboardingDraftKey("user-1", false)).not.toBe(onboardingDraftKey("user-1", true));
    expect(onboardingDraftKey("user-1", false)).not.toBe(onboardingDraftKey("user-2", false));
  });

  it("accepts only complete versioned onboarding drafts", () => {
    const saved = { version: 1, additional: true, prefillWebsite: "", prefillGoal: "", mode: "form", chat: "", name: "Shop", nameOverride: null, website: "", noWebsite: true, description: "A local shop" } as const;
    expect(parseOnboardingDraft(JSON.stringify(saved))).toEqual(saved);
    expect(parseOnboardingDraft("not json")).toBeNull();
    expect(parseOnboardingDraft(JSON.stringify({ ...saved, website: 42 }))).toBeNull();
  });
});
