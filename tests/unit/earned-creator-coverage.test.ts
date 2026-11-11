import { describe, expect, it } from "vitest";
import { CHANNEL_BY_ID } from "../../shared/acquisition/library";
import { adjustmentsFrom, candidatesFor, priceFitReason, scoreChannels, type AcquisitionProfile, type Adjustment } from "../../shared/acquisition/scoring";
import { channelWork } from "../../shared/acquisition/makeItHappen";

const mac: AcquisitionProfile = { types: ["desktop_app"], typesSource: "owner", priceUsdMonth: 6, budgetUsd: 0, horizonDays: 90, dims: {} };
const fit: Adjustment = { channelId: "R21", deltas: { audience: 30, intent: 30 }, reason: "A focused workflow demonstration may fit.", evidence: "The supplied creator profile shows Mac workflow demonstrations.", evidenceBasis: "source_reported", evidenceConfidence: "medium", evidenceDate: "2026-11-09", sourceUrl: "https://creator.example/mac-workflows", purpose: "Demonstrate the app to Mac users with this workflow problem.", measurementPlan: "Track activated app trials from the specific demonstration link." };

describe("earned coverage is distinct from paid sponsorship", () => {
  it("keeps a researchable creator route for a low-price Mac app without assuming cash or placement", () => {
    expect(CHANNEL_BY_ID.R21.minMonthly).toBe(0);
    expect(CHANNEL_BY_ID.R18.minMonthly).toBeGreaterThan(0);
    expect(candidatesFor(mac).some((c) => c.id === "R21")).toBe(true);
    expect(priceFitReason(CHANNEL_BY_ID.R21, mac)).toBeUndefined();
    expect(channelWork(CHANNEL_BY_ID.R21).draft).toBeNull();
    expect(channelWork(CHANNEL_BY_ID.R21).todos[0].title).toContain("Research");
    const withoutEvidence = scoreChannels(mac, [], undefined, {}, undefined, "2026-11-09").find((c) => c.id === "R21")!;
    expect(withoutEvidence.status).toBe("not_now");
    const researched = scoreChannels(mac, [fit], undefined, {}, undefined, "2026-11-09").find((c) => c.id === "R21")!;
    expect(researched.limits?.some((limit) => limit.kind === "cash" && limit.verdict === "blocked")).toBe(false);
    expect(researched.evidence).toBe(fit.evidence);
    expect(researched.why).not.toMatch(/doesn't pay back|rarely pays back/);
  });

  it("drops a source-reported scoring adjustment when its citation was not in the evidence supplied", () => {
    const row = { id: "R21", deltas: [30, 30], reason: fit.reason!, evidence: fit.evidence, platform: "YouTube", tactic: "Earned demonstration", audience: "Mac users", sourceUrl: fit.sourceUrl };
    expect(adjustmentsFrom({ channels: [row] }, { sourceUrls: [] })).toEqual([]);
    expect(adjustmentsFrom({ channels: [row] }, { sourceUrls: [fit.sourceUrl!] })).toHaveLength(1);
  });

  it.each(["instagram", "facebook", "linkedin", "x", "tiktok", "youtube", "pinterest"])("prepares the selected %s channel instead of silently defaulting to LinkedIn", (channel) => {
    const labels: Record<string, string> = { x: "X", youtube: "YouTube" };
    const result = channelWork({ id: "test", family: channel === "youtube" ? "video_audio" : "organic_social", name: labels[channel] ?? channel });
    expect(result.draft).toMatchObject({ job: "content_social", channel });
    if (["youtube", "tiktok", "pinterest"].includes(channel)) expect(result.todos[0].description).toContain("can't publish here directly");
  });
});
