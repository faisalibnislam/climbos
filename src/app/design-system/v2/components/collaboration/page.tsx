import type { Metadata } from "next";
import { CollaborationContent } from "./content";

export const metadata: Metadata = { title: "Collaboration" };

export default function CollaborationPage() {
  return <CollaborationContent />;
}
