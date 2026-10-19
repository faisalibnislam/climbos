import type { Metadata } from "next";
import { LayoutContent } from "./content";

export const metadata: Metadata = { title: "Layout & density" };

export default function LayoutPage() {
  return <LayoutContent />;
}
