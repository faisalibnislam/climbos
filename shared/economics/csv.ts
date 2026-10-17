import { type CalculatorInputs, COST_LINE_KEYS, COST_LINE_LABELS, computeAllProfiles } from "./calculator";
import { microsToUsd } from "./money";

function cell(value: string | number): string {
  const s = typeof value === "number" ? String(Number(value.toFixed(6))) : value;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of the twelve plan/profile rows (one row per plan × profile). */
export function economicsCsv(inputs: CalculatorInputs = {}): string {
  const rows = computeAllProfiles(inputs);
  const header = [
    "plan",
    "profile",
    "list_price_usd",
    "revenue_net_refunds_usd",
    ...COST_LINE_KEYS.map((k) => `${k}_usd`),
    "direct_cogs_usd",
    "payment_fees_usd",
    "total_cogs_usd",
    "gross_profit_usd",
    "gross_margin",
    "minimum_list_price_usd",
    "stress_revenue_usd",
    "stress_direct_cogs_usd",
    "stress_payment_fees_usd",
    "stress_total_cogs_usd",
    "stress_gross_margin",
    "stress_minimum_list_price_usd",
    "meets_target",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.plan,
        r.profile,
        microsToUsd(r.listPriceMicros),
        microsToUsd(r.revenueMicros),
        ...COST_LINE_KEYS.map((k) => microsToUsd(r.lines[k])),
        microsToUsd(r.directCogsMicros),
        microsToUsd(r.paymentFeesMicros),
        microsToUsd(r.totalCogsMicros),
        microsToUsd(r.grossProfitMicros),
        r.grossMargin,
        r.minimumListPriceUsd,
        microsToUsd(r.stress.revenueMicros),
        microsToUsd(r.stress.directCogsMicros),
        microsToUsd(r.stress.paymentFeesMicros),
        microsToUsd(r.stress.totalCogsMicros),
        r.stress.grossMargin,
        r.stress.minimumListPriceUsd,
        r.meetsTarget ? "yes" : "no",
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export { COST_LINE_LABELS };
