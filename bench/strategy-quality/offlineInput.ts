import { localToday } from "../../shared/agents/campaignTiming";
import { playsTask } from "../../shared/agents/planTasks";
import type { AgentInput } from "../../shared/agents/types";
import type { StrategyQualityCase } from "./cases";

/** Offline review uses its own clock, never an inferred business location. */
export function offlineInput(item: StrategyQualityCase, now = Date.now()): AgentInput {
  const timingContext = { today: localToday("UTC", now), timezone: "UTC", now };
  return {
    timingContext,
    task: `${playsTask({ scorecard: "No scored channel evidence supplied. Investigate fit; do not treat library priors as customer evidence.", insights: item.research.notes, horizonDays: 90, timingContext })}\nUTC is only this offline evaluation clock, not evidence of business or customer geography or an owner-confirmed setting. Keep served geography and business-local timezone unknown unless separately supplied.`,
    brief: item.brief,
    facts: item.facts,
    ...(item.businessWebsite ? { businessWebsite: item.businessWebsite } : {}),
    availableSourceUrls: item.research.sources.map((source) => source.url),
    precomputedResearch: { notes: item.research.notes, sources: item.research.sources },
    constraints: { monthlyAdBudgetUsd: 0, horizonDays: 90, businessTypes: [item.businessType] },
  };
}

