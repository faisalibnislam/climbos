import type { RateVersion } from "../economics/rates";
import { MODEL_SPECS } from "./models";
import { openaiTurn } from "./openai";
import type { TurnRequest, TurnResult } from "./types";

/** One model turn. Every agent and Climb AI model is OpenAI (Luna or Sol). */
export function modelTurn(req: TurnRequest, rates: RateVersion): Promise<TurnResult> {
  return openaiTurn(req, rates);
}

export function providerOf(modelKey: TurnRequest["modelKey"]): "google" | "openai" {
  return MODEL_SPECS[modelKey].provider;
}
