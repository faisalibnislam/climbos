import type { ModelKey, Provider, RateVersion } from "../economics/rates";
import { MODEL_SPECS } from "./models";

/**
 * Admin-controlled model choice (owner decision, 26 Oct 2026).
 *
 * Every route in shared/agents/routes.ts is written against two tiers:
 * - standard: research, drafts, reviews and single-call tasks (built-in default GPT-6 Luna);
 * - advanced: the Expert escalation after a measured review failure (built-in default GPT-6.1 Sol).
 * The operator sets a default model per tier in /ops. A user the operator has
 * enabled may pick one model for a run, which then serves both tiers.
 * A run stores its resolved route, so estimates, reservations, execution and
 * usage records all use the same models and the run's rate version.
 */

export type ModelTier = "standard" | "advanced";
export const MODEL_TIERS: readonly ModelTier[] = ["standard", "advanced"];

export interface ModelRoute {
  standard: ModelKey;
  advanced: ModelKey;
  /** "default" = operator defaults (or built-in); "user" = a permitted user's choice for this run. */
  source: "default" | "user";
}

export const BUILT_IN_ROUTE: ModelRoute = { standard: "gpt-6-luna", advanced: "gpt-6.1-sol", source: "default" };

export const TIER_LABELS: Record<ModelTier, { label: string; detail: string }> = {
  standard: { label: "Standard", detail: "Research, drafts, reviews and quick tasks." },
  advanced: { label: "Advanced", detail: "Climb AI Expert revisions after a failed review." },
};

export const PROVIDER_LABELS: Record<Provider, string> = { openai: "OpenAI", anthropic: "Anthropic", google: "Google Gemini" };

/** Server env var holding each provider's key (values are set in the Convex dashboard, never in code). */
export const PROVIDER_ENV: Record<Provider, string> = { openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY", google: "GEMINI_API_KEY" };

export function providerKeyConfigured(provider: Provider, env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env[PROVIDER_ENV[provider]]);
}

export function isModelKey(value: string): value is ModelKey {
  return Object.prototype.hasOwnProperty.call(MODEL_SPECS, value);
}

/** A model a run may use: known, enabled, and its provider's key is configured. */
export function modelAvailable(key: ModelKey, env: Record<string, string | undefined> = process.env): boolean {
  const spec = MODEL_SPECS[key];
  return Boolean(spec && spec.availability === "enabled" && providerKeyConfigured(spec.provider, env));
}

/** The model a route serves for a step written against `key` (other models, e.g. image or legacy routes, pass through). */
export function routeModelKey(route: ModelRoute | undefined, key: ModelKey): ModelKey {
  if (!route) return key;
  if (key === BUILT_IN_ROUTE.standard) return route.standard;
  if (key === BUILT_IN_ROUTE.advanced) return route.advanced;
  return key;
}

/** A user's single choice serves both tiers. */
export function userRoute(key: ModelKey): ModelRoute {
  return { standard: key, advanced: key, source: "user" };
}

export interface ModelOption {
  key: ModelKey;
  label: string;
  provider: Provider;
  providerLabel: string;
  inputPerM: number;
  outputPerM: number;
  available: boolean;
}

/**
 * Every callable model, cheapest first (input + output per 1M tokens at the
 * given rate version, then output), with whether its provider key is set.
 */
export function modelOptions(rates: RateVersion, env: Record<string, string | undefined> = process.env): ModelOption[] {
  return (Object.keys(MODEL_SPECS) as ModelKey[])
    .filter((key) => MODEL_SPECS[key].availability === "enabled")
    .map((key) => {
      const rate = rates.models[key];
      const provider = MODEL_SPECS[key].provider;
      return { key, label: rate.displayName, provider, providerLabel: PROVIDER_LABELS[provider], inputPerM: rate.inputPerM, outputPerM: rate.outputPerM, available: modelAvailable(key, env) };
    })
    .sort((a, b) => a.inputPerM + a.outputPerM - (b.inputPerM + b.outputPerM) || a.outputPerM - b.outputPerM || a.label.localeCompare(b.label));
}

/** The model a stored run uses for a step written against `key` (runs saved before model choice use the built-in route). */
export function runModel(run: { modelRoute?: { standard: string; advanced: string; source: "default" | "user" } }, key: ModelKey): ModelKey {
  const r = run.modelRoute;
  if (!r || !isModelKey(r.standard) || !isModelKey(r.advanced)) return key;
  return routeModelKey({ standard: r.standard, advanced: r.advanced, source: r.source }, key);
}
