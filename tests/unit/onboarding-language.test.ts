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
    if (name === "orgs:newWorkspaceAiMode") return { expertUnlocked: false, estimates: { onboarding_research: { basic: 190_000, expert: 160_000 } } };
    return undefined;
  },
  useMutation: () => vi.fn(),
}));

// Static rendering never runs effects; run each effect once so the form renders as it does after its
// draft-restore step (no stored draft, so the intake starts empty).
const ranEffects = vi.hoisted(() => new Set<string>());
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useEffect: (effect: () => void, deps?: unknown[]) => {
    const key = `${effect.toString().length}:${JSON.stringify(deps ?? [])}`;
    if (ranEffects.has(key)) return;
    ranEffects.add(key);
    effect();
  } };
});
vi.stubGlobal("window", { requestAnimationFrame: (cb: () => void) => { cb(); return 0; }, cancelAnimationFrame: () => undefined, sessionStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } });

import { OnboardingFlow } from "../../src/components/app/onboarding/OnboardingFlow";

describe("business setup starts with understandable, isolated intake", () => {
  beforeEach(() => { state.params = ""; state.orgs = []; ranEffects.clear(); });

  it("lets a first-time owner describe their business without a website or business jargon", () => {
    const html = renderToStaticMarkup(createElement(OnboardingFlow));
    expect(html).toContain("Tell us about your business");
    expect(html).toContain("I do not have a website yet.");
    expect(html).toContain("Your business and what you need");
    expect(html).toContain("Research uses up to 19 credits.");
    expect(html).toContain("unused reserved credits are returned.");
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
