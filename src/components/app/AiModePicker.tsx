"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RadioCards, Skeleton } from "@/components/ui";
import { microsToDisplay } from "./money";

export type AiMode = "basic" | "expert";
type ModeKind = "onboarding_research" | "strategy" | "content_ads" | "social_calendar";

/** The picker's state: starts at the workspace default (Expert for paid, Basic otherwise). */
export function useAiMode(slug: string) {
  const data = useQuery(api.workspace.aiMode, { slug });
  // null = follow the workspace default until the owner picks.
  const [mode, setMode] = useState<AiMode | null>(null);
  const effective: AiMode = data?.expertUnlocked ? (mode ?? data.mode) : "basic";
  return { data, mode: effective, setMode };
}

/** Climb AI Basic vs Expert for a workspace (default, lock and per-mode cost from the server). */
export function AiModePicker({
  slug,
  kind,
  value,
  onChange,
  label,
}: {
  slug: string;
  kind?: ModeKind;
  value: AiMode;
  onChange: (m: AiMode) => void;
  label?: string;
}) {
  const data = useQuery(api.workspace.aiMode, { slug });
  if (!data) return <Skeleton className="h-24 w-full" />;
  return <AiModeChoice unlocked={data.expertUnlocked} costs={kind ? data.estimates[kind] : undefined} value={value} onChange={onChange} label={label} upgradeHref={`/app/${slug}/settings/billing`} />;
}

/**
 * The two options. Basic (Luna) is fast and low-cost; Expert (Sol writes the
 * analysis) is for paid plans and shown locked on free ones.
 */
export function AiModeChoice({
  unlocked,
  costs,
  value,
  onChange,
  label = "How deep should the team go?",
  upgradeHref,
}: {
  unlocked: boolean;
  costs?: Record<AiMode, number>;
  value: AiMode;
  onChange: (m: AiMode) => void;
  label?: string;
  upgradeHref?: string;
}) {
  const cost = (m: AiMode) => (costs ? ` Up to ${microsToDisplay(costs[m])}.` : "");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      <RadioCards
        value={unlocked ? value : "basic"}
        onValueChange={(v) => onChange(v as AiMode)}
        options={[
          { value: "basic", title: "Climb AI Basic", description: `Fast and low-cost. Good for most work.${cost("basic")}` },
          {
            value: "expert",
            disabled: !unlocked,
            title: (
              <span className="flex flex-wrap items-center gap-2">
                Climb AI Expert
                {!unlocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2">
                    <Lock aria-hidden className="size-3" /> Paid plans
                  </span>
                ) : null}
              </span>
            ),
            description: `Deeper analysis by a stronger model for plans, insights, ads and the weekly plan.${unlocked ? cost("expert") : ""}`,
          },
        ]}
      />
      {!unlocked ? (
        <p className="text-xs text-ink-3">
          Expert unlocks with a paid plan.
          {upgradeHref ? (
            <>
              {" "}
              <Link href={upgradeHref} className="font-medium text-brand-800 hover:underline">
                See plans
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </fieldset>
  );
}
