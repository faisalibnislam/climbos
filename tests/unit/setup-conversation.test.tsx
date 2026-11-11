import { beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name === "workspace:aiMode") return { mode: "basic", expertUnlocked: false };
    if (name === "workspace:planQuote") return { maxCostMicros: 190_000 };
    return undefined;
  },
  useMutation: () => vi.fn().mockResolvedValue({ needsGoal: false }),
}));
const effects = vi.hoisted(() => new Set<string>());
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useEffect: (effect: () => void, deps: unknown[]) => {
    const key = `${effect.toString()}:${JSON.stringify(deps)}`;
    if (effects.has(key)) return;
    effects.add(key); effect();
  } };
});
vi.stubGlobal("requestAnimationFrame", (fn: () => void) => { fn(); return 0; });
vi.stubGlobal("cancelAnimationFrame", () => undefined);
vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => undefined });

import { SetupConversation } from "../../src/components/app/onboarding/SetupConversation";
type State = FunctionReturnType<typeof api.orgs.onboardingState>;
const fixture = (patch: Partial<State> = {}): State => ({
  org: { slug: "isolated-ui", name: "Isolated UI", kind: "customer", onboardingStep: "plan", currency: "USD", timezone: "UTC" }, role: "owner", business: { name: "Isolated UI", currency: "USD", onboardingIntro: { goalStatement: "I want more website visitors." } }, goal: { id: "goal-test", statement: "I want more website visitors.", monthlyAdBudget: 0 }, autonomy: "review", canRunAi: true, firstWinRunIds: [], strategy: null, strategyRun: null, ...patch,
} as State);
beforeEach(() => effects.clear());

it("carries a known wish forward with safe defaults and an explicit costed plan action", () => {
  const html = renderToStaticMarkup(createElement(SetupConversation, { slug: "isolated-ui", userId: "owner", state: fixture() }));
  expect(html).toContain("I want more website visitors.");
  expect(html).toContain("without buying ads");
  expect(html).toContain("19 credits");
  expect(html).toContain("Make my plan");
  for (const removed of ["Choose a goal", "Review day", "Analysis detail", "AI settings", "Who should publish or send", "Approval style", "Monthly ad budget (USD)"]) expect(html).not.toContain(removed);
});

it("asks a single goal question only when owner intent is missing, labeling website suggestions", () => {
  const state = fixture({ org: { ...fixture().org, onboardingStep: "goal" }, goal: null, business: { ...fixture().business!, onboardingIntro: null, researchFocus: { title: "Improve the signup page", why: "Public website research", effort: "small" } } });
  const html = renderToStaticMarkup(createElement(SetupConversation, { slug: "isolated-ui", userId: "owner", state }));
  expect(html).toContain("What would you most like help with?");
  expect(html).toContain("Improve the signup page");
  expect(html).toContain("Help me choose the best first step.");
  expect(html).not.toContain("Make my plan");
});

it("opens the existing recommendation when a plan is ready instead of asking to regenerate", () => {
  const state = fixture({ org: { ...fixture().org, onboardingStep: "done" }, strategy: { id: "strategy-test", status: "needs_approval", version: 1, createdAt: 1 } } as Partial<State>);
  const html = renderToStaticMarkup(createElement(SetupConversation, { slug: "isolated-ui", userId: "owner", state }));
  expect(html).toContain("Show my next step");
  expect(html).not.toContain("Make my plan");
  expect(html).not.toContain("Checking the AI cost");
});
