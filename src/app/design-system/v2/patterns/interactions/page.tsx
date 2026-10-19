import type { Metadata } from "next";
import { InteractionsContent } from "./content";

export const metadata: Metadata = { title: "Interactions" };

export default function InteractionsPage() {
  return <InteractionsContent />;
}
