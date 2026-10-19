import type { Metadata } from "next";
import { ContentPatterns } from "./content";

export const metadata: Metadata = { title: "Content" };

export default function ContentPage() {
  return <ContentPatterns />;
}
