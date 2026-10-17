import type { Metadata } from "next";
import { DesignSystemReference } from "./DesignSystemReference";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/** Living reference for docs/DesignSystem.md: every token and component in one place. */
export default function DesignSystemPage() {
  return <DesignSystemReference />;
}
