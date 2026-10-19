import type { Metadata } from "next";
import { StatesContent } from "./content";

export const metadata: Metadata = { title: "States" };

export default function StatesPage() {
  return <StatesContent />;
}
