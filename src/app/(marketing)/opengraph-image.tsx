import { ImageResponse } from "next/og";

export const alt = "ClimbOS — your AI growth team. Tell us your goal; you approve anything that goes live.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Simple branded social card (static, generated at build time). ImageResponse
 * can't read CSS variables, so the hex values below mirror the Summit tokens:
 * bg #eef0ee, ink #1c2220, ink-2 #434b47, brand-800 #0b5d46, and the logo mark.
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
          background: "#eef0ee",
          color: "#1c2220",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#0b5d46" />
            <path d="M7 23l6.5-9 4 5 3-4L25 23z" fill="#ffffff" />
            <circle cx="22" cy="9.5" r="2.5" fill="#ff9a4d" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>ClimbOS</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Your AI growth team for small businesses
          </div>
          <div style={{ fontSize: 32, color: "#434b47", maxWidth: 940, lineHeight: 1.35 }}>
            Tell us your goal. ClimbOS plans it, creates it and measures it — you approve anything that goes live.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#0b5d46", fontWeight: 600 }}>climbos.app</div>
      </div>
    ),
    size,
  );
}
