import type { Metadata } from "next";
import { OverlaysContent } from "./content";

export const metadata: Metadata = { title: "Overlays" };

export default function OverlaysPage() {
  return <OverlaysContent />;
}
