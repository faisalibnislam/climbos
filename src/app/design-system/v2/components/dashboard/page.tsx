import type { Metadata } from "next";
import { DashboardContent } from "./content";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardContent />;
}
