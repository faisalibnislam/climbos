import type { Metadata } from "next";
import { ChartsContent } from "./content";

export const metadata: Metadata = { title: "Charts & analytics" };

export default function ChartsPage() {
  return <ChartsContent />;
}
