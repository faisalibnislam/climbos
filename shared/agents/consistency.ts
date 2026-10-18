import type { z } from "zod";
import { CALL_ROUTES } from "./routes";
import type { LintIssue } from "./types";
import type { TurnRequest, TurnResult } from "../ai/types";

/**
 * Final consistency pass (Luna, cheap): one editor reconciles every field of
 * the plan with the locked numbers and removes contradictions. Kept only if
 * it doesn't add rule errors.
 */
const RULES = `You are the final editor of a small-business growth plan. Make it ONE coherent, owner-ready document:
- Every number (customers, budgets, cost per customer, payback, targets, dates) must match LOCKED NUMBERS exactly; fix any field that says otherwise.
- Remove contradictions between fields (budgets, channels running or not, scale/kill rules, targets). State each rule once.
- Drop or rewrite anything that relies on a play the numbers show loses money.
- Change only what's needed. Keep facts, sources and the plan's choices. Stay within the word limits. Return the full plan as JSON.`;

export async function reconcile<T>(p: { turn: (req: TurnRequest) => Promise<TurnResult>; plan: T; locked: string; schema: z.ZodType<T>; lint: (o: T) => LintIssue[]; caps?: string }): Promise<{ plan: T; changed: boolean }> {
  const r = await p.turn({
    modelKey: CALL_ROUTES.chat_intent,
    cacheKey: "climbos:plan_consistency",
    verbosity: "low",
    system: [{ text: RULES, cache: true }],
    messages: [{ role: "user", content: `${p.locked}${p.caps ? `\n\n${p.caps}` : ""}\n\nTHE PLAN (JSON):\n${JSON.stringify(p.plan)}` }],
    schema: p.schema,
    maxTokens: 16_000,
    effort: "medium",
  });
  if (!r.ok) return { plan: p.plan, changed: false };
  const next = r.output as T;
  const errors = (o: T) => p.lint(o).filter((l) => l.severity === "error").length;
  return errors(next) <= errors(p.plan) ? { plan: next, changed: true } : { plan: p.plan, changed: false };
}
