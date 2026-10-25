import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";

const state = vi.hoisted(() => ({ params: "", orgs: [] as { slug: string; kind: string; role: string; onboardingStep: string }[] }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(state.params),
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name === "orgs:me") return { userId: "test-owner", isAnonymous: false, orgs: state.orgs };
    if (name === "orgs:newWorkspaceAiMode") return { expertUnlocked: false };
    return undefined;
  },
  useMutation: () => vi.fn(),
}));

import { OnboardingFlow } from "../../src/components/app/onboarding/OnboardingFlow";

describe("business setup starts with understandable, isolated intake", () => {
  beforeEach(() => { state.params = ""; state.orgs = []; });

  it("lets a first-time owner describe their business without a website or business jargon", () => {
    const html = renderToStaticMarkup(createElement(OnboardingFlow));
    expect(html).toContain("Tell us about your business");
    expect(html).toContain("I do not have a website yet.");
    expect(html).toContain("Your business and what you need");
    expect(html).not.toContain("bristolcrumb.co.uk");
    expect(html).not.toContain("AI CEO");
  });

  it("starts a fresh intake for another business instead of resuming the existing one", () => {
    state.params = "new=1";
    state.orgs = [{ slug: "first-company", kind: "customer", role: "owner", onboardingStep: "facts" }];
    const html = renderToStaticMarkup(createElement(OnboardingFlow));
    expect(html).toContain("Tell us about your next business");
    expect(html).toContain("Your other businesses keep their own details and accounts.");
    expect(html).not.toContain("Is this right?");
  });

  it("does not fall back to another company's setup for an unauthorized explicit link", () => {
    state.params = "workspace=someone-elses-business";
    state.orgs = [{ slug: "my-company", kind: "customer", role: "owner", onboardingStep: "facts" }];
    const html = renderToStaticMarkup(createElement(OnboardingFlow));
    expect(html).toContain("You cannot set up this business");
    expect(html).not.toContain("Create business &amp; continue");
    expect(html).not.toContain("Is this right?");
  });
});
