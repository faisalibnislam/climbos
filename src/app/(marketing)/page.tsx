import type { Metadata } from "next";
import { LANDING_FAQ, PRODUCT_LINE } from "@/components/marketing/content";
import {
  CapabilityGrid,
  Faq,
  FinalCta,
  Hero,
  HowItWorks,
  PricingTeaser,
  TeamGrid,
  TrustSection,
  WontDo,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: { absolute: "ClimbOS — your AI growth team for small businesses" },
  description: PRODUCT_LINE,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <TeamGrid />
      <CapabilityGrid />
      <TrustSection />
      <WontDo />
      <PricingTeaser />
      <Faq items={LANDING_FAQ} />
      <FinalCta className="bg-surface" />
    </>
  );
}
