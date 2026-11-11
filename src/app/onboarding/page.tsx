import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingFlow } from "@/components/app/onboarding/OnboardingFlow";

export const metadata: Metadata = { title: "What's your wish?" };

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}
