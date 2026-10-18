import type { Metadata } from "next";
import { DesignRenderFrame } from "@/components/design/DesignRenderFrame";

export const metadata: Metadata = { title: "Render", robots: { index: false, follow: false } };

/** Internal page the render worker screenshots: the design is injected by the worker, never fetched. */
export default function DesignRenderPage() {
  return <DesignRenderFrame />;
}
