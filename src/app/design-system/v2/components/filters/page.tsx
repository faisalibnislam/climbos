import type { Metadata } from "next";
import { FiltersContent } from "./content";

export const metadata: Metadata = { title: "Filters & search" };

export default function FiltersPage() {
  return <FiltersContent />;
}
