import { describe, expect, it } from "vitest";
import { creatorIdentity, targetBrief, targetKindOf, targetReadiness, type TargetRow } from "../../shared/growth/targets";

/** S6 (REQ-TARGET-01..06, REQ-CREATOR-01): which plays need targets, creator identity, honest readiness. */
describe("which plays need targets", () => {
  it("the engine the planner named decides first", () => {
    expect(targetKindOf({ name: "Studio collabs", climbosCanDo: "Creator finder drafts 10 pitches a week" })).toBe("creators");
    expect(targetKindOf({ name: "Agency partners", climbosCanDo: "Find customers + outreach: 50 emails a week" })).toBe("customers");
  });
  it("falls back to the play's wording; content and retention plays need no search", () => {
    expect(targetKindOf({ name: "Micro-influencer demos", mechanic: "Gifted product for a tutorial" })).toBe("creators");
    expect(targetKindOf({ name: "Podcast guest tour", mechanic: "Pitch hosts in our niche" })).toBe("creators");
    expect(targetKindOf({ name: "Reseller program", mechanic: "Recruit agencies that resell" })).toBe("customers");
    expect(targetKindOf({ name: "Comparison pages", mechanic: "Write vs-competitor pages", climbosCanDo: "Drafts the pages" })).toBeNull();
    expect(targetKindOf({ name: "Win back lapsed customers", mechanic: "Email past buyers a return offer", climbosCanDo: "Sends the emails" })).toBeNull();
  });
  it("the search brief is the play's audience, a 10-target shortlist", () => {
    expect(targetBrief({ name: "X", audience: "UK yoga studios with 2+ locations" })).toEqual({ who: "UK yoga studios with 2+ locations", where: "", count: 10 });
  });
});

describe("creator identity (REQ-TARGET-03)", () => {
  it("two creators on one platform stay distinct; a shared domain is never the identity", () => {
    const a = creatorIdentity("https://www.instagram.com/studio.ana/");
    const b = creatorIdentity("instagram.com/bodybyben");
    expect(a).toEqual({ platform: "instagram", handle: "studio.ana", key: "instagram:studio.ana" });
    expect(b?.key).toBe("instagram:bodybyben");
    expect(a?.key).not.toBe(b?.key);
  });
  it("URL variants of one profile match", () => {
    const keys = ["https://instagram.com/Studio.Ana", "https://m.instagram.com/studio.ana/?hl=en", "https://www.instagram.com/studio.ana/reels/"].map((u) => creatorIdentity(u)?.key);
    expect(new Set(keys)).toEqual(new Set(["instagram:studio.ana"]));
    expect(creatorIdentity("https://www.tiktok.com/@studio.ana/video/123")?.key).toBe("tiktok:studio.ana");
    expect(creatorIdentity("https://x.com/StudioAna/status/987")?.key).toBe("x:studioana");
  });
  it("YouTube uses the channel ID or handle, never a video", () => {
    expect(creatorIdentity("https://www.youtube.com/@ana")?.key).toBe("youtube:@ana");
    expect(creatorIdentity("https://youtube.com/channel/UC123abc")?.key).toBe("youtube:channel/uc123abc");
    expect(creatorIdentity("https://www.youtube.com/watch?v=abc")).toBeNull();
  });
  it("a post or reel URL alone names no account", () => {
    expect(creatorIdentity("https://www.instagram.com/p/Cxyz123/")).toBeNull();
    expect(creatorIdentity("https://www.instagram.com/reel/Cxyz123/")).toBeNull();
    expect(creatorIdentity("https://www.facebook.com/profile.php?id=1000123")?.key).toBe("facebook:id/1000123");
  });
  it("a creator's own site or newsletter keys by host", () => {
    expect(creatorIdentity("https://anaeats.substack.com/p/post")?.key).toBe("substack:anaeats");
    expect(creatorIdentity("https://anamoves.com/about")?.key).toBe("web:anamoves.com");
  });
});

describe("honest readiness (REQ-TARGET-05/06)", () => {
  const row = (o: Partial<TargetRow> = {}): TargetRow => ({ stage: "suggested", publicEmail: null, suppressed: false, ...o });
  const base = { kind: "creators" as const, mailboxConnected: true };
  it("no search yet, or one is in the way", () => {
    expect(targetReadiness({ ...base, campaign: null, targets: [] }).state).toBe("not_started");
    expect(targetReadiness({ ...base, campaign: null, waitingReason: "Your current campaign is sending.", targets: [] })).toMatchObject({ state: "waiting", note: "Your current campaign is sending." });
  });
  it("researching, failed and none found are distinct", () => {
    expect(targetReadiness({ ...base, campaign: { status: "researching" }, targets: [] }).state).toBe("researching");
    expect(targetReadiness({ ...base, campaign: { status: "failed" }, targets: [] }).state).toBe("failed");
    expect(targetReadiness({ ...base, campaign: { status: "review" }, targets: [] }).state).toBe("none_found");
  });
  it("missing contact routes keep the profiles and ask the owner (no email invented)", () => {
    const r = targetReadiness({ ...base, campaign: { status: "review" }, targets: [row(), row()] });
    expect(r).toMatchObject({ state: "no_contact_route", found: 2, eligible: 2, contactable: 0 });
    expect(r.note).toMatch(/no public contact route/);
  });
  it("a contactable target with no mailbox needs a connection; with one it's ready", () => {
    const targets = [row({ publicEmail: "hi@ana.com" }), row()];
    expect(targetReadiness({ ...base, mailboxConnected: false, campaign: { status: "review" }, targets }).state).toBe("needs_connection");
    expect(targetReadiness({ ...base, campaign: { status: "review" }, targets })).toMatchObject({ state: "ready", contactable: 1, eligible: 2 });
  });
  it("declined, opted-out and already-contacted targets are never counted as contactable", () => {
    const targets = [row({ stage: "skipped", publicEmail: "a@x.com" }), row({ suppressed: true, publicEmail: "b@x.com" }), row({ stage: "contacted", publicEmail: "c@x.com" }), row({ stage: "won", publicEmail: "d@x.com" })];
    const r = targetReadiness({ ...base, campaign: { status: "review" }, targets });
    expect(r).toMatchObject({ state: "none_found", found: 4, eligible: 0, contactable: 0, excluded: 2, inRelationship: 2 });
    expect(r.note).toMatch(/none are contacted again/);
  });
});
