import type { Provider, RateVersion } from "../economics/rates";
import { anthropicTurn } from "./anthropic";
import { geminiTurn } from "./gemini";
import { MODEL_SPECS } from "./models";
import { openaiTurn } from "./openai";
import type { TurnRequest, TurnResult } from "./types";

/** One model turn, on the adapter for the model's provider (OpenAI by default; Anthropic and Gemini when chosen). */
export function modelTurn(req: TurnRequest, rates: RateVersion): Promise<TurnResult> {
  const provider = MODEL_SPECS[req.modelKey].provider;
  if (provider === "anthropic") return anthropicTurn(req, rates);
  if (provider === "google") return geminiTurn(req, rates);
  return openaiTurn(req, rates);
}

export function providerOf(modelKey: TurnRequest["modelKey"]): Provider {
  return MODEL_SPECS[modelKey].provider;
}
