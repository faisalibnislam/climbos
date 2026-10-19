import type { Metadata } from "next";
import { ShapeContent } from "./content";

export const metadata: Metadata = { title: "Shape & elevation" };

export default function ShapePage() {
  return <ShapeContent />;
}
