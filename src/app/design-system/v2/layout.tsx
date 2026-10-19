import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DesignShell } from "./_kit/shell";

export const metadata: Metadata = {
  title: { default: "Design system · Signal", template: "%s · Signal design system" },
  robots: { index: false, follow: false },
};

/** Signal design system: grouped sidebar, ⌘K search and density toggle around every page. */
export default function DesignSystemV2Layout({ children }: { children: ReactNode }) {
  return <DesignShell>{children}</DesignShell>;
}
