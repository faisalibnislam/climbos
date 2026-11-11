/** Project allowance arithmetic; allocated local funds already include local usage. */
export type EvaluationReceipt = { label: string; chargedMicros: number; status?: string };
export function localEvaluationAllocation(capMicros: number, receipts: EvaluationReceipt[], historical: EvaluationReceipt[], allocationMicros: number) {
  if (capMicros !== 100_000_000 || !Number.isSafeInteger(allocationMicros) || allocationMicros < 10_000_000 || allocationMicros > capMicros || allocationMicros % 1_000_000 !== 0) throw new Error("Invalid owner-authorized project allocation.");
  const sum = (rows: EvaluationReceipt[]) => rows.reduce((total, row) => {
    if (!Number.isSafeInteger(row.chargedMicros) || row.chargedMicros < 0) throw new Error("Invalid budget receipt.");
    return total + row.chargedMicros;
  }, 0);
  const current = sum(receipts.filter(row => row.status === "allocated_to_local_convex"));
  if (allocationMicros < current) throw new Error("Cannot reduce an existing local allocation.");
  const deltaMicros = allocationMicros - current;
  const committedMicros = sum(receipts) + sum(historical) + deltaMicros;
  if (committedMicros > capMicros) throw new Error("Local allowance would exceed the cumulative $100 budget.");
  return { allocationMicros, deltaMicros, committedMicros, remainingMicros: capMicros - committedMicros, walletCeilingMicros: allocationMicros * 3 / 5 };
}
