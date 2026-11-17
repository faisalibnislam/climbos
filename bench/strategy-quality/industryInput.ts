import type { AgentInput } from "../../shared/agents/types";
import { focusedPlanTask } from "../../shared/agents/focusedPlan";
import { localToday } from "../../shared/agents/campaignTiming";
import { campaignTimingTask } from "../../shared/agents/planTasks";
import type { StrategyQualityCase } from "./cases";

/** Isolated benchmark inputs are not facts about a real tenant. */
export function industryInput(item: StrategyQualityCase, now = Date.now()): AgentInput {
  const timingContext = { today: localToday("UTC", now), timezone: "UTC", now };
  return {
    creativeRetrievalQuery: [item.brief, ...item.facts].join("\n"),
    task: `${focusedPlanTask(14)}\n${campaignTimingTask(timingContext)}\nUTC is only this synthetic evaluation's workspace clock, not an owner-confirmed setting or evidence of customer geography. Keep business-local timezone and served geography unknown unless separately supplied. Put the primary move's assessment in focusedMove.timingAssessment; use not_relevant for an evergreen move.`,
    timingContext,
    brief: item.brief.replace(/over 90 days/g, "over 14 days"),
    facts: item.facts,
    precomputedResearch: item.research,
    availableSourceUrls: item.research.sources.map(source => source.url),
    constraints: { currency: "USD", horizonDays: 14, monthlyAdBudgetUsd: 0, businessTypes: [item.businessType] },
  };
}
