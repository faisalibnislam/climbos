import type { Metadata } from "next";
import { AIContent } from "./content";

export const metadata: Metadata = { title: "AI" };

export default function AIPage() {
  return <AIContent />;
}
