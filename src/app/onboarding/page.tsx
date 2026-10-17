import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingFlow } from "@/components/app/onboarding/OnboardingFlow";

export const metadata: Metadata = { title: "Set up your growth team" };

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}
