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
    await makePaid(t, orgId);
    await owner.client.mutation(api.reels.create, { slug, brief: "Second reel" });
    await t.finishAllScheduledFunctions(() => undefined);
    expect((await owner.client.query(api.reels.list, { slug }))[0].badge).toBe(false);
  });
});
