"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { creditsToMicros } from "../../../shared/economics/credits";
import { microsToCreditsLabel, microsToUsdCost, microsToUsdLeft, microsToUsdUpTo } from "./money";

/**
 * How this user sees cost: credits (everyone, by default) or real API cost in
 * dollars, which only an operator can turn on (ops → AI models). The server
 * decides; until it answers, credits are shown. Billing is in credits either way.
 */
export function useCostDisplay() {
  const mode = useQuery(api.costDisplay.myCostDisplay, {})?.mode;
  const usd = mode === "usd";
  return {
    usd,
    /** A worst case ("up to"). */
    upTo: (micros: number) => (usd ? microsToUsdUpTo(micros) : microsToCreditsLabel(micros)),
    /** What a run used: provider-billed cost in dollars, or the credits charged. */
    spent: (chargedMicros: number, providerMicros?: number) => (usd ? microsToUsdCost(providerMicros ?? chargedMicros) : microsToCreditsLabel(chargedMicros)),
    /** A credit balance: dollars of usage left, or the credit count. */
    left: (credits: number) => (usd ? microsToUsdLeft(creditsToMicros(credits)) : credits.toLocaleString("en-US")),
  };
}
