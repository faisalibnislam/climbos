import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHero } from "@/components/marketing/layout";
import { CTA, PRODUCT_LINE } from "@/components/marketing/content";
import { CapabilityGrid, FinalCta, HowItWorks, TeamGrid, TrustSection } from "@/components/marketing/sections";
import { buttonClasses } from "@/components/ui/button-styles";

export const metadata: Metadata = {
  title: "How it works",
  description: "See how ClimbOS goes from your goal to a plan, finished work and plain-English results — with your approval before anything goes live.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <section aria-labelledby="hiw-heading" className="bg-bg">
        <Container className="pb-4 pt-14 sm:pt-20">
          <PageHero
            id="hiw-heading"
            eyebrow="How it works"
            title="A growth team that does the work — and checks with you first"
            lead={PRODUCT_LINE}
          >
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={CTA.start.href} className={buttonClasses({ size: "lg" })}>
                {CTA.start.label}
              </Link>
              <Link href={CTA.demo.href} className={buttonClasses({ variant: "secondary", size: "lg" })}>
                {CTA.demo.label}
              </Link>
            </div>
          </PageHero>
        </Container>
      </section>
      <HowItWorks compact />
      <TeamGrid />
      <CapabilityGrid />
      <TrustSection />
      <FinalCta />
    </>
  );
}
