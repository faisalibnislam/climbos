import type { Metadata } from "next";
import { ActionsContent } from "./content";

export const metadata: Metadata = { title: "Buttons & actions" };

export default function ActionsPage() {
  return <ActionsContent />;
}
