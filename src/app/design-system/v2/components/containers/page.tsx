import type { Metadata } from "next";
import { ContainersContent } from "./content";

export const metadata: Metadata = { title: "Cards & containers" };

export default function ContainersPage() {
  return <ContainersContent />;
}
