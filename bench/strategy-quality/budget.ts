/** USD millionths. Public rate check: 2026-11-09; official gpt-6-luna model/pricing pages. */
export const QA_CAP_MICROS = 2_000_000;
export function reserveLunaCall(inputBytesBound: number, maxOutput: number, usedOrHeldMicros: number): number {
  if (!Number.isSafeInteger(inputBytesBound) || inputBytesBound < 1 || inputBytesBound > 950_000 || !Number.isSafeInteger(maxOutput) || maxOutput < 1 || maxOutput > 64_000 || !Number.isSafeInteger(usedOrHeldMicros) || usedOrHeldMicros < 0) throw new Error("Invalid QA request or budget ledger.");
  // Input uses the long-context $0.20/M rate; output $1/M exceeds its $0.75/M rate.
  const reserve = Math.ceil(inputBytesBound * 0.2 + maxOutput);
  if (usedOrHeldMicros + reserve > QA_CAP_MICROS) throw new Error("QA_BUDGET_EXHAUSTED: the next call cannot fit inside the cumulative $2 cap.");
  return reserve;
}
export function lunaActualMicros(input: number, output: number, cached: number): number | null {
  if (![input, output, cached].every((n) => Number.isSafeInteger(n) && n >= 0) || cached > input) return null;
  const long = input > 272_000;
  return Math.ceil((input - cached) * (long ? 0.2 : 0.1) + cached * (long ? 0.02 : 0.01) + output * (long ? 0.75 : 0.5));
}
