type GoalTarget = {
  metric: "customers" | "revenue_month" | "other";
  baseline: number | null;
  desired: number | null;
  mode: "total" | "incremental";
};

function currencyAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-US")} ${currency}`;
  }
}

function targetAmount(target: GoalTarget, amount: number, currency: string): string {
  if (target.metric === "customers") {
    const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(amount);
    return target.mode === "incremental" ? `${count} new customers` : `${count} customers total`;
  }
  if (target.metric === "revenue_month") {
    const value = currencyAmount(amount, currency);
    return target.mode === "incremental" ? `${value} more in monthly revenue` : `${value} monthly revenue`;
  }
  const value = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(amount);
  return `${target.mode === "incremental" ? "Additional target" : "Target amount"}: ${value} (measure not specified)`;
}

function baselineAmount(target: GoalTarget, amount: number, currency: string): string {
  if (target.metric === "customers") return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(amount)} customers`;
  if (target.metric === "revenue_month") return `${currencyAmount(amount, currency)} monthly revenue`;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(amount)} (measure not specified)`;
}

/** Shows only the structured target the owner entered; this is not a progress measure. */
export function OwnerGoalTarget({
  target,
  currency,
  horizonDays,
}: {
  target: GoalTarget | null;
  currency: string;
  horizonDays: number;
}) {
  if (!target || target.desired === null || !Number.isFinite(target.desired)) return null;

  return (
    <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5">
      <p className="text-xs font-medium text-ink-3">Your target · {horizonDays} days</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{targetAmount(target, target.desired, currency)}</p>
      <p className="mt-1 text-xs text-ink-3">
        {target.baseline !== null && Number.isFinite(target.baseline)
          ? `Starting point in your goal: ${baselineAmount(target, target.baseline, currency)}.`
          : "Starting point not entered."} Your target, not a measured result.
      </p>
    </div>
  );
}
