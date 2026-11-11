import { expect, it } from "vitest";
import { localEvaluationAllocation } from "../../shared/economics/evaluationBudget";
it("extends only the reserved local envelope and preserves other paid or uncertain commitments", () => {
  const receipts = [{ label: "known-and-held", chargedMicros: 30_424_529 }, { label: "local", chargedMicros: 10_000_000, status: "allocated_to_local_convex" }];
  const old = [{ label: "older-paid-and-uncertain", chargedMicros: 1_896_709 }];
  const result = localEvaluationAllocation(100_000_000, receipts, old, 20_000_000);
  expect(result).toEqual({ allocationMicros: 20_000_000, deltaMicros: 10_000_000, committedMicros: 52_321_238, remainingMicros: 47_678_762, walletCeilingMicros: 12_000_000 });
  const extended = [...receipts, { label: "extension", chargedMicros: result.deltaMicros, status: "allocated_to_local_convex" }];
  expect(localEvaluationAllocation(100_000_000, extended, old, 20_000_000).deltaMicros).toBe(0);
  expect(() => localEvaluationAllocation(100_000_000, extended, old, 10_000_000)).toThrow(/reduce/);
  expect(() => localEvaluationAllocation(100_000_000, receipts, old, 70_000_000)).toThrow(/cumulative/);
});
