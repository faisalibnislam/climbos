import { STANDARD_SLOT, ADVANCED_SLOT } from "../../shared/agents/routes";
import type { PlannedStep } from "./estimate";
export const STEP_WORK_STEPS: PlannedStep[] = [
  { kind: "model", role: "coo", modelKey: STANDARD_SLOT, inputBudget: 80000, outputBudget: 8000, webSearches: 2 },
  { kind: "model", role: "coo", modelKey: ADVANCED_SLOT, inputBudget: 30000, outputBudget: 5500 },
  { kind: "model", role: "coo", modelKey: ADVANCED_SLOT, inputBudget: 36000, outputBudget: 5500 },
];
