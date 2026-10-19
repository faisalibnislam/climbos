import type { Metadata } from "next";
import { NavigationContent } from "./content";

export const metadata: Metadata = { title: "Navigation" };

export default function NavigationPage() {
  return <NavigationContent />;
}
