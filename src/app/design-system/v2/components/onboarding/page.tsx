import type { Metadata } from "next";
import { OnboardingContent } from "./content";

export const metadata: Metadata = { title: "Onboarding & help" };

export default function OnboardingPage() {
  return <OnboardingContent />;
}
