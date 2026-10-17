import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/marketing/layout";
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
      <section aria-labelledby="hiw-heading" className="hero-glow">
        <Container className="pb-4 pt-14 sm:pt-20">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-green-700">How it works</p>
          <h1 id="hiw-heading" className="mt-2 max-w-3xl font-display text-[2.4rem] font-semibold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            A growth team that does the work — and checks with you first
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{PRODUCT_LINE}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={CTA.start.href} className={buttonClasses({ size: "lg" })}>
              {CTA.start.label}
            </Link>
            <Link href={CTA.demo.href} className={buttonClasses({ variant: "secondary", size: "lg" })}>
              {CTA.demo.label}
            </Link>
          </div>
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
