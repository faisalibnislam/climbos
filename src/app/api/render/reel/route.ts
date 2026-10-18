import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { NextResponse } from "next/server";
import { ffmpegArgs, REEL_H, REEL_W, reelSeconds, sceneHtml, type ReelBrand, type ReelScene, type SceneInput } from "@shared/render/reel";
import { launchBrowser, safePublicUrl } from "@/lib/render/browser";

export const runtime = "nodejs";
export const maxDuration = 180;

const run = promisify(execFile);

/**
 * ClimbOS reel worker: draws each scene as a 1080×1920 frame in headless
 * Chrome, then ffmpeg adds motion and cross-fades and encodes an MP4.
 * Called only by the Convex backend with the shared server secret. Images
 * must be public https URLs or data: URLs; nothing else is loaded.
 */
export async function POST(req: Request) {
  const secret = process.env.CLIMBOS_SERVER_SECRET;
  if (!secret || req.headers.get("x-climbos-secret") !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { scenes?: ReelScene[]; brand?: ReelBrand; secondsEach?: number; badge?: boolean };
  const scenes = (body.scenes ?? []).slice(0, 8).map((s) => ({ ...s, caption: String(s.caption ?? "").slice(0, 120), sub: s.sub ? String(s.sub).slice(0, 160) : undefined, imageUrl: s.imageUrl && (s.imageUrl.startsWith("data:image/") || safePublicUrl(s.imageUrl)) ? s.imageUrl : undefined, videoUrl: s.videoUrl && safePublicUrl(s.videoUrl) ? s.videoUrl : undefined }));
  if (scenes.length < 2) return NextResponse.json({ error: "A reel needs at least 2 scenes." }, { status: 400 });
  const brand: ReelBrand = { name: String(body.brand?.name ?? "").slice(0, 40), color: String(body.brand?.color ?? "#0b5d46"), website: body.brand?.website ? String(body.brand.website).slice(0, 80) : undefined };
  const secondsEach = Math.max(2, Math.min(5, body.secondsEach ?? 3));
  const dir = await mkdtemp(join(tmpdir(), "reel-"));
  const t0 = Date.now();
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: REEL_W, height: REEL_H }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    // Only the scene's own image, data: URLs and Google Fonts may load.
    await page.route("**/*", (route) => {
      const u = route.request().url();
      const ok = u.startsWith("data:") || u.startsWith("about:") || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u) || (safePublicUrl(u) && scenes.some((s) => s.imageUrl === u));
      return ok ? route.continue() : route.abort();
    });
    const frames: SceneInput[] = [];
    for (let i = 0; i < scenes.length; i++) {
      // Video scenes: download the clip, then draw only the captions on a transparent frame.
      let video: string | null = null;
      if (scenes[i].videoUrl) {
        const r = await fetch(scenes[i].videoUrl!).catch(() => null);
        if (r?.ok) {
          video = join(dir, `clip-${i}.mp4`);
          await writeFile(video, Buffer.from(await r.arrayBuffer()));
        }
      }
      await page.setContent(sceneHtml(scenes[i], brand, i, scenes.length, Boolean(body.badge), Boolean(video)), { waitUntil: "networkidle", timeout: 20_000 }).catch(() => undefined);
      await page.evaluate(() => document.fonts.ready).catch(() => undefined);
      const file = join(dir, `scene-${i}.png`);
      await writeFile(file, await page.screenshot({ type: "png", omitBackground: Boolean(video) }));
      frames.push(video ? { video, overlay: file } : file);
    }
    await context.close();
    const out = join(dir, "reel.mp4");
    if (!ffmpegPath) throw new Error("ffmpeg isn't available on this server.");
    await run(ffmpegPath, ffmpegArgs(frames, secondsEach, out), { timeout: 150_000, maxBuffer: 10_000_000 });
    const mp4 = await readFile(out);
    console.log(`[reel] ${scenes.length} scenes, ${mp4.length} bytes, ${Date.now() - t0}ms`);
    return NextResponse.json({ mp4: mp4.toString("base64"), seconds: reelSeconds(scenes.length, secondsEach), width: REEL_W, height: REEL_H });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 300) }, { status: 500 });
  } finally {
    await browser.close().catch(() => undefined);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
