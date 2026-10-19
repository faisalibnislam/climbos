import { ImageResponse } from "next/og";
import { MARK, WORDMARK } from "@/components/brand/Logo";

export const alt = "ClimbOS — your AI growth team. Tell us your goal; you approve anything that goes live.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Simple branded social card (static, generated at build time). ImageResponse
 * can't read CSS variables, so the hex values below mirror the Signal tokens:
 * bg #e8ece5, ink #161815, ink-2 #444841, brand-800 #4d6043; the logo sits on ink.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#e8ece5",
          color: "#161815",
        }}
      >
        <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", gap: 18, background: "#161815", borderRadius: 8, padding: "18px 26px" }}>
          <svg width="64" height="64" viewBox="0 0 762 762">
            {MARK.map((p, i) => (
              <path key={i} d={p.d} fill={p.fill} />
            ))}
          </svg>
          <svg height="44" viewBox="915 120 3847 662" width={Math.round((3847 / 662) * 44)}>
            <path d={WORDMARK} fill="#ffffff" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Your AI growth team for small businesses
          </div>
          <div style={{ fontSize: 32, color: "#444841", maxWidth: 940, lineHeight: 1.35 }}>
            Tell us your goal. ClimbOS plans it, creates it and measures it — you approve anything that goes live.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#4d6043", fontWeight: 600 }}>climbos.app</div>
      </div>
    ),
    size,
  );
}
