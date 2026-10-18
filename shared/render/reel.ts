/**
 * Reels (our own renderer): each scene is a 1080×1920 frame drawn as HTML in
 * headless Chrome (real web fonts, brand colour), then ffmpeg adds a slow
 * zoom, cross-fades and encodes an MP4 that Instagram, TikTok and YouTube
 * Shorts accept. Pure helpers here; the worker route runs them.
 */

export const REEL_W = 1080;
export const REEL_H = 1920;
export const FADE_SECONDS = 0.4;

export interface ReelScene {
  /** Image behind the caption (https URL or data: URL). Absent = brand-colour card. */
  imageUrl?: string;
  caption: string;
  sub?: string;
  /** Final call-to-action card. */
  cta?: boolean;
  /** An AI video clip for this scene (mp4 URL); the caption is overlaid on it. */
  videoUrl?: string;
}

export interface ReelBrand {
  name: string;
  color: string;
  website?: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function safeColor(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#0b5d46";
}

/** One scene as a full HTML document sized to the reel frame. */
export function sceneHtml(scene: ReelScene, brand: ReelBrand, index: number, total: number, badge: boolean, overlay = false): string {
  const color = safeColor(brand.color);
  const dots = Array.from({ length: total }, (_, i) => `<span class="dot${i === index ? " on" : ""}"></span>`).join("");
  // Overlay mode: transparent frame (captions only) laid over a video clip.
  const bg = !overlay && scene.imageUrl && !scene.cta ? `<img class="bg" src="${esc(scene.imageUrl)}" alt="" />` : "";
  return `<!doctype html><html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" /><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;800&display=block" rel="stylesheet" />
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${REEL_W}px;height:${REEL_H}px;overflow:hidden;background:${overlay ? "transparent" : scene.cta || !scene.imageUrl ? color : "#000"};font-family:Inter,system-ui,sans-serif}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 35%,rgba(0,0,0,.78) 100%)}
.text{position:absolute;left:84px;right:84px;bottom:${scene.cta ? 760 : 300}px;color:#fff}
.cap{font-weight:800;font-size:${scene.caption.length > 40 ? 84 : 104}px;line-height:1.04;letter-spacing:-.02em;text-wrap:balance}
.sub{margin-top:28px;font-weight:500;font-size:46px;line-height:1.25;opacity:.92;text-wrap:balance}
.bar{position:absolute;left:84px;bottom:${scene.cta ? 700 : 240}px;width:140px;height:12px;border-radius:6px;background:${scene.cta ? "#fff" : color}}
.brand{position:absolute;left:84px;top:110px;color:#fff;font-weight:800;font-size:44px;letter-spacing:-.01em;text-shadow:0 2px 12px rgba(0,0,0,.35)}
.dots{position:absolute;left:84px;right:84px;top:76px;display:flex;gap:10px}
.dot{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.35)}.dot.on{background:#fff}
.site{margin-top:40px;font-weight:800;font-size:56px}
.badge{position:absolute;right:48px;bottom:56px;color:rgba(255,255,255,.85);font-weight:500;font-size:30px;background:rgba(0,0,0,.35);padding:10px 20px;border-radius:999px}
</style></head><body>
${bg}${scene.cta || (!scene.imageUrl && !overlay) ? "" : '<div class="shade"></div>'}
<div class="dots">${dots}</div>
<div class="brand">${esc(brand.name)}</div>
<div class="bar"></div>
<div class="text"><div class="cap">${esc(scene.caption)}</div>${scene.sub ? `<div class="sub">${esc(scene.sub)}</div>` : ""}${scene.cta && brand.website ? `<div class="site">${esc(brand.website.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</div>` : ""}</div>
${badge ? '<div class="badge">Made with ClimbOS</div>' : ""}
</body></html>`;
}

/** Total length with cross-fades. */
export function reelSeconds(scenes: number, secondsEach: number): number {
  return Math.round((scenes * secondsEach - Math.max(0, scenes - 1) * FADE_SECONDS) * 10) / 10;
}

/**
 * ffmpeg arguments: each PNG frame gets a slow zoom for `secondsEach`, then
 * frames are cross-faded in order, with a silent stereo track (platforms
 * expect audio), H.264 + AAC, fast start.
 */
/** A scene input: a still frame (PNG) or a video clip with a transparent caption overlay (PNG). */
export type SceneInput = string | { video: string; overlay: string };

export function ffmpegArgs(frames: SceneInput[], secondsEach: number, out: string): string[] {
  const fps = 30;
  const d = Math.round(secondsEach * fps);
  const args: string[] = ["-y"];
  // Input order: per scene its frame (or video then overlay); then the silent audio track.
  const idx: { main: number; overlay?: number }[] = [];
  let n = 0;
  for (const f of frames) {
    if (typeof f === "string") {
      args.push("-i", f);
      idx.push({ main: n++ });
    } else {
      args.push("-i", f.video, "-i", f.overlay);
      idx.push({ main: n++, overlay: n++ });
    }
  }
  const total = reelSeconds(frames.length, secondsEach);
  args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo");
  const audioIndex = n;
  const parts: string[] = [];
  frames.forEach((f, i) => {
    const { main, overlay } = idx[i];
    if (typeof f !== "string") {
      // Video clip: fill the vertical frame, trim to the scene, lay the captions on top.
      parts.push(`[${main}:v]scale=${REEL_W}:${REEL_H}:force_original_aspect_ratio=increase,crop=${REEL_W}:${REEL_H},fps=${fps},trim=0:${secondsEach},setpts=PTS-STARTPTS,setsar=1[c${i}]`);
      parts.push(`[c${i}][${overlay}:v]overlay=0:0,format=yuv420p[v${i}]`);
      return;
    }
    // Alternate zoom in / zoom out so consecutive scenes don't feel identical.
    const z = i % 2 === 0 ? "min(zoom+0.0006,1.08)" : "if(eq(on,0),1.08,max(zoom-0.0006,1.0))";
    parts.push(`[${main}:v]scale=${REEL_W * 2}:${REEL_H * 2},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${REEL_W}x${REEL_H}:fps=${fps},setsar=1,format=yuv420p[v${i}]`);
  });
  let last = "v0";
  for (let i = 1; i < frames.length; i++) {
    const offset = Math.round((i * secondsEach - i * FADE_SECONDS) * 100) / 100;
    const label = i === frames.length - 1 ? "vout" : `x${i}`;
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${FADE_SECONDS}:offset=${offset}[${label}]`);
    last = label;
  }
  if (frames.length === 1) parts.push(`[v0]null[vout]`);
  args.push("-filter_complex", parts.join(";"), "-map", "[vout]", "-map", `${audioIndex}:a`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", out);
  return args;
}
