import { describe, expect, it } from "vitest";
import { businessModelFreshness, readBusinessModelEvidence, type BusinessModelEvidence } from "../../shared/agents/businessModelFreshness";
import { businessModelEvidenceHashes } from "../../convex/lib/businessModelEvidence";

const now = Date.UTC(2026, 10, 16);
const hashes = Object.fromEntries(["workspace", "business", "facts", "brand", "goal", "billing", "pipeline", "competitors"].map(key => [key, "a".repeat(64)])) as BusinessModelEvidence["hashes"];
const snapshot: BusinessModelEvidence = { version: 1, contextHash: "c".repeat(64), capturedAt: now, hashes };

describe("business model evidence freshness", () => {
  it("distinguishes unchanged inputs, changed groups, review interval and missing or invalid snapshots", () => {
    expect(businessModelFreshness(snapshot, hashes, now).status).toBe("unchanged");
    expect(businessModelFreshness(snapshot, { ...hashes, facts: "b".repeat(64) }, now)).toMatchObject({ status: "changed", changed: ["facts"] });
    expect(businessModelFreshness(snapshot, hashes, now + 30 * 86_400_000)).toMatchObject({ status: "review_due", reason: expect.stringContaining("not proof the judgment is wrong") });
    expect(businessModelFreshness(null, hashes, now).status).toBe("unknown");
    expect(businessModelFreshness({ ...snapshot, capturedAt: now + 1 }, hashes, now).status).toBe("unknown");
    expect(readBusinessModelEvidence(JSON.stringify({ businessModelEvidence: snapshot }))).toEqual(snapshot);
    expect(readBusinessModelEvidence(JSON.stringify({ businessModelEvidence: { ...snapshot, hashes: {} } }))).toBeNull();
    expect(readBusinessModelEvidence("bad json")).toBeNull();
  });

  it("ignores read order and ingestion metadata while noticing edited historical billing values", async () => {
    const input = { org: { _id: "org", name: "Example", currency: "USD" }, business: null, brand: null, goal: null, facts: [], pipelineDeals: [], marketChanges: [], revenueRows: [
      { _id: "a", _creationTime: 1, orgId: "org", source: "csv", sourceEventId: "a", occurredAt: now - 100, amountMinor: 100, refundedMinor: 0, kind: "order", currency: "USD", isFixture: false, ingestedAt: 1 },
      { _id: "b", _creationTime: 2, orgId: "org", source: "csv", sourceEventId: "b", occurredAt: now - 50, amountMinor: 200, refundedMinor: 0, kind: "order", currency: "USD", isFixture: false, ingestedAt: 2 },
    ] } as unknown as Parameters<typeof businessModelEvidenceHashes>[0];
    const before = await businessModelEvidenceHashes(input, now);
    const reordered = { ...input, revenueRows: [...input.revenueRows].reverse().map(row => ({ ...row, ingestedAt: now })) };
    expect(await businessModelEvidenceHashes(reordered, now)).toEqual(before);
    const corrected = { ...input, revenueRows: input.revenueRows.map((row, i) => i === 0 ? { ...row, refundedMinor: 50 } : row) };
    const after = await businessModelEvidenceHashes(corrected, now);
    expect(businessModelFreshness({ ...snapshot, hashes: before }, after, now).changed).toEqual(["billing"]);
  });
});
