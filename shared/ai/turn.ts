import type { RateVersion } from "../economics/rates";
import { claudeTurn, type ClaudeTurnRequest, type ClaudeTurnResult } from "./claude";
import { MODEL_SPECS } from "./models";
import { openaiTurn } from "./openai";

/** One model turn on whichever provider serves `req.modelKey`. */
export function modelTurn(req: ClaudeTurnRequest, rates: RateVersion): Promise<ClaudeTurnResult> {
  return MODEL_SPECS[req.modelKey].provider === "openai" ? openaiTurn(req, rates) : claudeTurn(req, rates);
}

export function providerOf(modelKey: ClaudeTurnRequest["modelKey"]): "anthropic" | "google" | "openai" {
  return MODEL_SPECS[modelKey].provider;
}
