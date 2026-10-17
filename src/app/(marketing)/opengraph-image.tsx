import { ImageResponse } from "next/og";

export const alt = "ClimbOS — your AI growth team. Tell us your goal; you approve anything that goes live.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Simple branded social card (static, generated at build time). */
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
          background: "linear-gradient(135deg, #fbfaf6 0%, #f1f8f3 60%, #e3f1e7 100%)",
          color: "#1a1d1b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#14532d" />
            <path d="M7 23l6.5-9 4 5 3-4L25 23z" fill="#e3f1e7" />
            <circle cx="22" cy="9.5" r="2.5" fill="#c6e3cf" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>ClimbOS</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Your AI growth team for small businesses
          </div>
          <div style={{ fontSize: 32, color: "#454a45", maxWidth: 940, lineHeight: 1.35 }}>
            Tell us your goal. ClimbOS plans it, creates it and measures it — you approve anything that goes live.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#14532d", fontWeight: 600 }}>climbos.app</div>
      </div>
    ),
    size,
  );
}
