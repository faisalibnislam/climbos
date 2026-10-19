import type { Metadata } from "next";
import { SignalPreview } from "./SignalPreview";

export const metadata: Metadata = {
  title: "Design system · Signal",
  robots: { index: false, follow: false },
};

/** Proposed "Signal" theme (after the WAct reference), previewed before it replaces Summit. */
export default function SignalDesignSystemPage() {
  return <SignalPreview />;
}
