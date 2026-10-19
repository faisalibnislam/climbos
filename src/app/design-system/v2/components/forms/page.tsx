import type { Metadata } from "next";
import { FormsContent } from "./content";

export const metadata: Metadata = { title: "Forms" };

export default function FormsPage() {
  return <FormsContent />;
}
