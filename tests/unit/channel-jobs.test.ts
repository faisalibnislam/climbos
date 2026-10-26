import { describe, expect, it } from "vitest";
import { CHANNELS } from "../../shared/acquisition/library";
import { CHANNEL_JOB_LABEL, channelJob, recommendationGuidance } from "../../shared/acquisition/recommendationGroups";

describe("channel intended jobs (spec §6)", () => {
  it("gives every library channel one of the eight jobs", () => {
    for (const c of CHANNELS) expect(Object.keys(CHANNEL_JOB_LABEL)).toContain(channelJob(c.id));
    expect(Object.keys(CHANNEL_JOB_LABEL)).toHaveLength(8);
    expect(channelJob("nope")).toBeNull();
  });

  it("classifies the platforms the spec names", () => {
    expect(channelJob("M10")).toBe("launch");
    expect(channelJob("M11")).toBe("comparison");
    expect(channelJob("S09")).toBe("comparison");
    expect(channelJob("S04")).toBe("comparison");
    expect(channelJob("S01")).toBe("search");
    expect(channelJob("N01")).toBe("community");
  });

  it("gives app stores their own purpose and measurement", () => {
    for (const id of ["M06", "M07", "S18"]) expect(recommendationGuidance(id)).toMatchObject({ group: "app_store", measurement: expect.stringContaining("not customer or revenue outcomes") });
  });
});
