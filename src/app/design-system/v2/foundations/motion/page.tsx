import type { Metadata } from "next";
import { MotionContent } from "./content";

export const metadata: Metadata = { title: "Motion" };

export default function MotionPage() {
  return <MotionContent />;
}
