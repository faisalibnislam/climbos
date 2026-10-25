/** Browser-tab draft keys are isolated by both signed-in person and workspace. */
export function askDraftKey(slug: string, userId: string) {
  return `climbos:ask:v2:${userId}:${slug}`;
}

export function wishDraftKey(slug: string, userId: string) {
  return `climbos:wish:v1:${userId}:${slug}`;
}

export function onboardingDraftKey(userId: string, additional: boolean) {
  return `climbos:onboarding:v1:${userId}:${additional ? "next" : "first"}`;
}

export interface OnboardingDraft {
  version: 1;
  additional: boolean;
  prefillWebsite: string;
  prefillGoal: string;
  mode: "chat" | "form";
  chat: string;
  name: string;
  nameOverride: string | null;
  website: string;
  noWebsite: boolean;
  description: string;
}

/** Reject stale or malformed tab data instead of restoring partial form state. */
export function parseOnboardingDraft(value: string | null): OnboardingDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OnboardingDraft> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.additional !== "boolean" || typeof parsed.prefillWebsite !== "string" || typeof parsed.prefillGoal !== "string" || (parsed.mode !== "chat" && parsed.mode !== "form") || typeof parsed.chat !== "string" || typeof parsed.name !== "string" || (parsed.nameOverride !== null && typeof parsed.nameOverride !== "string") || typeof parsed.website !== "string" || typeof parsed.noWebsite !== "boolean" || typeof parsed.description !== "string") return null;
    return parsed as OnboardingDraft;
  } catch {
    return null;
  }
}
