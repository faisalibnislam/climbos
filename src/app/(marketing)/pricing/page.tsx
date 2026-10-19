import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Coins } from "@/components/icons"
import { Container, PageHero, Section, SectionHeading } from "@/components/marketing/layout";
import { CreditExamples, PlanCards, PlanComparison } from "@/components/marketing/pricing";
import { getTopups, lowestPaidPrice } from "@/components/marketing/plans";
import { Faq, FinalCta } from "@/components/marketing/sections";
import { CTA } from "@/components/marketing/content";
import { buttonClasses } from "@/components/ui/button-styles";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free to start. Packages from ${formatUsd(lowestPaidPrice())} a month. Pay for the work in credits, shown before every job.`,
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  const topups = getTopups();
  const faq = [
    {
      q: "What is a credit?",
      a: "Credits pay for the work your AI team does: research, writing, images and web searches. 1 credit is about 1¢ of AI work. Every job shows the most it can use before it starts, then charges only what it actually used.",
    },
    {
      q: "What do I get for free?",
      a: "50 credits once: enough to research your business, build a growth plan on Climb AI Basic and draft your first posts. Free accounts have one workspace and one person; you copy drafts and post them yourself.",
    },
    {
      q: "What happens when I run out?",
      a: "New work waits until your credits reset at your next renewal. If you want more sooner, buy a top-up — only when you click buy. Nothing is ever charged automatically.",
    },
    {
      q: "Do unused credits roll over?",
      a: "Monthly credits reset at each renewal. Top-up credits last 12 months and are used after your monthly credits.",
    },
    {
      q: "What's Climb AI Expert?",
      a: "On packages, your growth plan, business insights, ads and weekly autopilot plan are written by a stronger model for deeper analysis. Everything else uses Climb AI Basic. You can pick either each time.",
    },
    {
      q: "Is ad spend included?",
      a: "No. Ad spend is paid directly to Google or Meta from your own ad account, within the budget you approve. ClimbOS never marks it up or handles that money.",
    },
    {
      q: "Can my team or my clients share an account?",
      a: "Yes. Credits and people are per account and shared across all your workspaces, so an agency can run several client workspaces on one bill and cap each workspace's monthly credits.",
    },
    {
      q: "Do prices include tax?",
      a: "Prices are in US dollars and don't include sales tax or VAT. Where it applies, tax is added at checkout.",
    },
  ];

  return (
    <>
      <section aria-labelledby="pricing-heading" className="bg-bg">
        <Container className="pb-8 pt-14 sm:pt-20">
          <PageHero
            id="pricing-heading"
            align="center"
            eyebrow="Pricing"
            title="Your whole growth team. Free to start."
            lead="Pay for the work in credits. Every job shows its credits before it starts and only charges what it used."
          >
            <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-2">
              {["50 free credits", "No automatic charges", "Ad spend paid directly to Google or Meta"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
                  {t}
                </li>
              ))}
            </ul>
          </PageHero>
        </Container>
      </section>

      <section aria-labelledby="plans-heading" className="bg-bg pb-16">
        <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
          <h2 id="plans-heading" className="sr-only">
            Plans
          </h2>
          <PlanCards />
          <p className="mt-6 text-center text-xs text-ink-3">
            Prices exclude applicable sales tax or VAT, which may be added at checkout. Start free; choose a package inside the app
            whenever you need more.
          </p>
        </div>
      </section>

      <Section labelledBy="compare-heading" className="bg-surface">
        <SectionHeading
          id="compare-heading"
          title="Compare"
          intro="Credits pay for the work; packages unlock autopilot, publishing, sending and your team."
        />
        <PlanComparison headingId="compare-heading" />
      </Section>

      <Section labelledBy="costs-heading">
        <SectionHeading id="costs-heading" title="What things cost" intro="The most each action can use. Jobs charge only what they actually use, usually much less." />
        <CreditExamples headingId="costs-heading" />
      </Section>

      <Section labelledBy="extras-heading">
        <SectionHeading id="extras-heading" title="Top-ups, only when you ask" />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-5">
            <Coins aria-hidden="true" className="size-5 text-brand-700" />
            <h3 className="mt-4 heading-section">Extra credits for packages</h3>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink-2">
              {topups.map((t) => (
                <li key={t.key}>
                  <strong className="font-semibold text-ink">{t.credits.toLocaleString("en-US")} credits</strong> · {formatUsd(t.priceUsd)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">One-time, from Settings → Billing. They last 12 months.</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="heading-section">Paid directly to other providers</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-2">
              <li>
                <strong className="font-semibold text-ink">Ad spend</strong> — paid to Google or Meta from your own ad account. Never
                marked up.
              </li>
              <li>
                <strong className="font-semibold text-ink">Your email provider&apos;s bill</strong> — for marketing emails sent
                through your own account.
              </li>
              <li>
                <strong className="font-semibold text-ink">SSO, SLA and agency services</strong> — by separate agreement.
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={CTA.start.href} className={buttonClasses({ size: "lg" })}>
            {CTA.start.label}
          </Link>
          <Link href={CTA.demo.href} className={buttonClasses({ variant: "secondary", size: "lg" })}>
            {CTA.demo.label}
          </Link>
        </div>
      </Section>

      <Faq items={faq} headingId="pricing-faq-heading" title="Pricing questions" className="bg-surface" />
      <FinalCta />
    </>
  );
}
