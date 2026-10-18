import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { ffmpegArgs, reelSeconds, sceneHtml } from "../../shared/render/reel";
import { asNewUser, makePaid, setup } from "./helpers";

describe("reels", () => {
  beforeEach(() => {
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("render helpers: escaped HTML, cross-fade timing and a valid ffmpeg graph", () => {
    const html = sceneHtml({ caption: "<b>Hi</b> & welcome", imageUrl: "https://x.example/a.png" }, { name: "Acme", color: "javascript:alert(1)" }, 0, 3, true);
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt; &amp; welcome");
    expect(html).toContain("#0b5d46"); // unsafe colour replaced
    expect(html).toContain("Made with ClimbOS");
    expect(reelSeconds(4, 3)).toBe(10.8);
    const args = ffmpegArgs(["a.png", "b.png", "c.png"], 3, "out.mp4");
    const graph = args[args.indexOf("-filter_complex") + 1];
    expect(graph).toContain("xfade=transition=fade:duration=0.4:offset=2.6");
    expect(graph).toContain("offset=5.2[vout]");
    expect(args.at(-1)).toBe("out.mp4");
  });

  it("a reel job writes the script, renders, and free accounts get the badge", async () => {
    const t = setup();
    const owner = await asNewUser(t, "reel@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Reel Co" });
    const { reelId } = await owner.client.mutation(api.reels.create, { slug, brief: "Show how fast our forms are" });
    await t.finishAllScheduledFunctions(() => undefined);
    const [r] = await owner.client.query(api.reels.list, { slug });
    expect(r).toMatchObject({ id: reelId, status: "ready", badge: true });
    // AI clips are for packages; a clip adds ~20 credits to the reservation.
    await expect(owner.client.mutation(api.reels.create, { slug, brief: "With a clip", clips: 1 })).rejects.toThrow(/comes with a package/);
    await makePaid(t, orgId);
    const est = await owner.client.query(api.reels.estimate, { slug });
    expect(est.clipsUnlocked).toBe(true);
    expect(est.withClipsMicros - est.maxCostMicros).toBe(200_000);
    await owner.client.mutation(api.reels.create, { slug, brief: "Second reel" });
    await t.finishAllScheduledFunctions(() => undefined);
    expect((await owner.client.query(api.reels.list, { slug }))[0].badge).toBe(false);
  });

  it("a finished reel becomes a post for approval and export, and can be deleted", async () => {
    const t = setup();
    const owner = await asNewUser(t, "reel-post@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Reel Co" });
    await owner.client.mutation(api.reels.create, { slug, brief: "Our autumn menu" });
    await t.finishAllScheduledFunctions(() => undefined);
    const [r] = await owner.client.query(api.reels.list, { slug });
    expect(r.isDemo).toBe(true); // no worker in tests: labelled, not passed off as a video
    expect(r.artifactId).toBeTruthy();
    const post = await owner.client.query(api.content.get, { slug, artifactId: r.artifactId! });
    expect(post).toMatchObject({ kind: "video_script", status: "in_review", publishTarget: null });
    expect(post.reel?.id).toBe(r.id);
    await owner.client.mutation(api.content.decide, { slug, artifactId: r.artifactId!, decision: "approve" });
    const pack = await owner.client.query(api.content.exportPack, { slug, artifactId: r.artifactId! });
    expect(pack?.pack.items.map((i) => i.platform).sort()).toEqual(["instagram", "tiktok", "youtube"]);

    await owner.client.mutation(api.reels.remove, { slug, reelId: r.id });
    expect(await owner.client.query(api.reels.list, { slug })).toHaveLength(0);
    expect((await owner.client.query(api.content.get, { slug, artifactId: r.artifactId! })).status).toBe("archived");
  });

  it("without the render worker a real reel fails clearly before spending", async () => {
    delete process.env.CLIMBOS_FAKE_LLM;
    const t = setup();
    delete process.env.CLIMBOS_SERVER_SECRET;
    const owner = await asNewUser(t, "reel-nosecret@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Reel Co" });
    await owner.client.mutation(api.reels.create, { slug, brief: "No worker here" });
    await t.finishAllScheduledFunctions(() => undefined);
    const [r] = await owner.client.query(api.reels.list, { slug });
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/isn't set up/);
    expect(r.artifactId).toBeNull();
  });
});
