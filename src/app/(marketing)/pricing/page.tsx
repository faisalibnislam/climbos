import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, PackagePlus } from "lucide-react";
import { Container, Section, SectionHeading } from "@/components/marketing/layout";
import { PlanCards, PlanComparison } from "@/components/marketing/pricing";
import { getTopup, lowestPrice } from "@/components/marketing/plans";
import { Faq, FinalCta } from "@/components/marketing/sections";
import { CTA } from "@/components/marketing/content";
import { buttonClasses } from "@/components/ui/button-styles";
import { formatUsd } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Simple monthly plans from ${formatUsd(lowestPrice())}. Every plan includes all ten AI growth roles, clear monthly limits and no automatic charges.`,
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  const topup = getTopup();
  const faq = [
    {
      q: "What do the monthly limits mean?",
      a: "They're the most ClimbOS will do for you in a month on that plan — for example, the number of social posts or images it creates. They reset every month. You're never charged for going over, because work simply pauses at the limit.",
    },
    {
      q: "What happens when I reach a limit?",
      a: `You'll get alerts at 70%, 90% and 100%. At 100%, new work of that kind waits until next month. If you'd like more sooner, you can buy an ${topup.name.toLowerCase()} (${formatUsd(topup.priceUsd)}) — only when you click buy.`,
    },
    {
      q: "Is ad spend included?",
      a: "No. Ad spend is paid directly to Google or Meta from your own ad account, within the budget you approve. ClimbOS never marks it up or handles that money.",
    },
    {
      q: "Who sends my marketing emails?",
      a: "Your own email provider. ClimbOS writes and schedules the emails; your provider sends them and bills you directly. Emails only go to people who agreed to hear from you.",
    },
    {
      q: "What does “You publish; ClimbOS drafts” mean on Basic?",
      a: "On Basic, ClimbOS prepares your plan and ready-to-post drafts, and you post them yourself. From Starter up, ClimbOS can publish to your connected accounts after you approve each item.",
    },
    {
      q: "Do prices include tax?",
      a: "Prices are in US dollars and don't include sales tax or VAT. Where it applies, tax is added at checkout.",
    },
    {
      q: "How do I choose or change a plan?",
      a: "Sign up first and explore your workspace. You choose a plan in Settings → Billing inside the app, and you can change it there later.",
    },
    {
      q: "Do you offer SSO, an SLA or agency services?",
      a: "Yes, by separate agreement. Get in touch at hello@climbos.app and tell us what you need.",
    },
  ];

  return (
    <>
      <section aria-labelledby="pricing-heading" className="hero-glow">
        <Container className="pb-8 pt-14 text-center sm:pt-20">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-green-700">Pricing</p>
          <h1 id="pricing-heading" className="mx-auto mt-2 max-w-3xl font-display text-[2.4rem] font-semibold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            Your whole growth team, one monthly price
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">
            Every plan includes all ten AI roles. Limits are monthly maximums — nothing is charged automatically.
          </p>
          <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-[0.95rem] text-ink-2">
            {["Prices in USD", "Ad spend paid directly to Google or Meta", "Alerts at 70%, 90% and 100%"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CircleCheck aria-hidden="true" className="size-4 text-green-700" />
                {t}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="plans-heading" className="pb-16">
        <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
          <h2 id="plans-heading" className="sr-only">
            Plans
          </h2>
          <PlanCards />
          <p className="mt-6 text-center text-sm text-ink-3">
            Prices exclude applicable sales tax or VAT, which may be added at checkout. You choose a plan inside the app after
            signing up.
          </p>
        </div>
      </section>

      <Section labelledBy="compare-heading" className="bg-surface-2/60">
        <SectionHeading
          id="compare-heading"
          title="Compare plans"
          intro="All numbers are monthly maximums. You're never billed for going over — work simply pauses at the limit."
        />
        <PlanComparison headingId="compare-heading" />
      </Section>

      <Section labelledBy="extras-heading">
        <SectionHeading id="extras-heading" title="Extra capacity, only when you ask" />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
            <PackagePlus aria-hidden="true" className="size-6 text-green-700" />
            <h3 className="mt-3 text-lg font-semibold text-ink">
              {topup.name} · {formatUsd(topup.priceUsd)}
            </h3>
            <p className="mt-2 leading-relaxed text-ink-2">{topup.description}</p>
            <p className="mt-2 text-sm text-ink-3">Bought from Settings → Billing, one click at a time.</p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6">
            <h3 className="text-lg font-semibold text-ink">Paid directly to other providers</h3>
            <ul className="mt-3 flex flex-col gap-2 leading-relaxed text-ink-2">
              <li>
                <strong className="font-semibold text-ink">Ad spend</strong> — paid to Google or Meta from your own ad account. Never
                marked up.
              </li>
              <li>
                <strong className="font-semibold text-ink">Your email provider&apos;s bill</strong> — for marketing emails sent
                through your own account.
              </li>
              <li>
                <strong className="font-semibold text-ink">Video production</strong> — quoted separately per job.
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

      <Faq items={faq} headingId="pricing-faq-heading" title="Pricing questions" />
      <FinalCta />
    </>
  );
}
