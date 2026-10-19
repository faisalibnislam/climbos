import type { Metadata } from "next";
import { DataContent } from "./content";

export const metadata: Metadata = { title: "Data display" };

export default function DataPage() {
  return <DataContent />;
}
