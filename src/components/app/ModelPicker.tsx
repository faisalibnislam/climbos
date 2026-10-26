"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Field, Select } from "@/components/ui";
import { microsToCreditsLabel } from "./money";

type ChoiceKind = "onboarding_research" | "strategy" | "content_social" | "content_ads" | "content_email" | "content_seo";
const DEFAULT = "__default";

/** The picked model (undefined = the ClimbOS default). Pass `model` to the mutation as-is. */
export function useModelChoice() {
  const [model, setModel] = useState<string | undefined>(undefined);
  return { model, setModel };
}

/**
 * Model picker, shown only to users a ClimbOS operator has enabled (everyone
 * else gets nothing and runs on the default). Lists connected models cheapest
 * first with this job's maximum cost; the server enforces the same rules.
 */
export function ModelPicker({ kind, aiMode, value, onChange }: { kind: ChoiceKind; aiMode?: "basic" | "expert"; value: string | undefined; onChange: (model: string | undefined) => void }) {
  const data = useQuery(api.models.myModelChoice, { kind, aiMode });
  if (!data?.canChoose) return null;
  const cost = (micros: number | null | undefined) => (micros == null ? "" : ` · up to ${microsToCreditsLabel(micros)}`);
  const defaultLabel = data.options.find((o) => o.key === data.defaultModel)?.label ?? "ClimbOS default";
  const options = [
    { value: DEFAULT, label: `Default (${defaultLabel})${cost(data.defaultEstimateMicros)}` },
    ...data.options.map((o) => ({ value: o.key, label: `${o.label} · ${o.providerLabel}${cost(o.estimateMicros)}` })),
  ];
  return (
    <Field label="AI model" hint="Cheapest first. Costs are the most this job can use; you pay only for what it uses.">
      <Select value={value ?? DEFAULT} onValueChange={(v) => onChange(v === DEFAULT ? undefined : v)} options={options} aria-label="AI model" />
    </Field>
  );
}

/** The chosen model's maximum cost for this job (undefined while loading or on the default). */
export function useChosenModelEstimate(kind: ChoiceKind, aiMode: "basic" | "expert" | undefined, model: string | undefined): number | undefined {
  const data = useQuery(api.models.myModelChoice, model ? { kind, aiMode } : "skip");
  return model ? (data?.options.find((o) => o.key === model)?.estimateMicros ?? undefined) : undefined;
}
