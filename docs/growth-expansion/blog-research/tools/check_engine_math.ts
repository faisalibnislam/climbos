/**
 * Cross-checks the blog-research worked examples against ClimbOS's own calculators.
 * Prints JSON; validate.py compares it with the expected values.
 * Run from the repo root: npx tsx docs/growth-expansion/blog-research/tools/check_engine_math.ts
 */
import { allowableCac, breakevenCpc, cacFull, contributionMonth, paybackSimple, paybackWithChurn } from "../../../../shared/growth/calc";
import { compareRates, sampleRatio } from "../../../../shared/analysis/decisions";

const cm = contributionMonth(100, 0.8)!;
console.log(
  JSON.stringify({
    ex1_cm: cm,
    ex1_payback_gm: paybackSimple(600, cm),
    ex1_payback_churn: paybackWithChurn(600, cm, 0.03),
    ex1_value_12m: allowableCac(cm, 0.03, 12),
    ex7_cac_now: cacFull(900, 30, 50, 0, 6),
    ex7_cac_full: cacFull(900, 30, 50, 150, 6),
    ex8_breakeven_cpc: breakevenCpc(816.42, 0.04, 0.2),
    srm_230_170: sampleRatio({ planned: [50, 50], observed: [230, 170] }).pValue,
    srm_9000_1000: sampleRatio({ planned: [50, 50], observed: [9000, 1000] }).mismatch,
    rates_18_12: compareRates({ control: { visitors: 120, conversions: 12 }, treatment: { visitors: 120, conversions: 18 } }).pValue,
  }),
);
