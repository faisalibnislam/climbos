import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Ban,
  ChevronDown,
  CirclePause,
  ClipboardList,
  Lock,
  ReceiptText,
  Scale,
  ShieldCheck,
  Wallet,
  MessageSquareText,
  Search,
  Compass,
  PenTool,
  CircleCheck,
  BarChart3,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const ROLE_KEYS: Record<string, string> = {
  creative: "creative_director",
  social: "social_media_manager",
  ads: "ads_manager",
  seo: "seo_specialist",
  data: "data_analyst",
  success: "customer_success_manager",
};

const STEP_ICONS: LucideIcon[] = [MessageSquareText, Search, Compass, PenTool, CircleCheck, BarChart3];
const STEP_TONES: Tone[] = ["brand", "violet", "pink", "orange", "green", "teal"];
import { buttonClasses } from "@/components/ui/button-styles";
import { IconTile } from "@/components/ui/icon-tile";
import type { Tone } from "@/components/ui/badge";
import { RoleAvatar } from "@/components/app/RoleAvatar";
import { cn, formatUsd } from "@/lib/utils";
import { CAPABILITIES, CTA, ROLES, STEPS, TRUST, WONT_DO } from "./content";
import { Container, Section, SectionHeading } from "./layout";
import { LivePreview } from "./LivePreview";
import { getPlans, lowestPrice, planLimitLines, RECOMMENDED_PLAN } from "./plans";

/** Landing hero (Apollo-style): a large white panel in a soft frame, serif headline, live preview. */
export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="bg-surface-3/60 px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-5">
      <div className="rounded-2xl border border-line bg-surface px-4 pb-14 pt-14 sm:pb-20 sm:pt-20">
        <Container className="flex flex-col items-center text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-sm font-medium text-ink-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-sun" />
            Your AI growth team, ready in minutes
          </p>
          <h1 id="hero-heading" className="mt-6 max-w-3xl text-[2.75rem] leading-[1.02] text-ink sm:text-6xl lg:text-7xl">
            Tell us your goal. We&apos;ll help you grow.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2 sm:text-xl">
            Ten AI specialists research your business, build the plan, create the work and measure what happens.{" "}
            <strong className="font-medium text-ink">You approve anything that goes live.</strong>
          </p>
          <div className="mt-10 w-full max-w-2xl text-left">
            <LivePreview />
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.95rem] text-ink-2">
            {[
              "Nothing posts, sends or spends without your OK",
              "Plans from " + formatUsd(lowestPrice()) + " a month",
              "No sign-up for the preview",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-pine" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[0.95rem] text-ink-2">
            Want to look around first?{" "}
            <Link href={CTA.demo.href} className="font-medium text-ink underline underline-offset-4">
              Try the demo
            </Link>{" "}
            — no account needed.
          </p>
        </Container>
      </div>
    </section>
  );
}

/** Six-step "how it works" timeline. */
export function HowItWorks({ headingId = "how-heading", compact = false }: { headingId?: string; compact?: boolean }) {
  return (
    <Section id="how-it-works" labelledBy={headingId} className={compact ? "py-12 sm:py-16" : undefined}>
      <SectionHeading
        id={headingId}
        eyebrow="How it works"
        title="From goal to results, in six clear steps"
        intro="You bring the goal and the final say. ClimbOS does the research, the planning, the making and the measuring."
      />
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative rounded-xl border border-line bg-surface p-6 transition hover:border-line-strong">
            <span className="flex items-center justify-between">
              <IconTile icon={STEP_ICONS[i] ?? Sparkles} tone={STEP_TONES[i] ?? "brand"} size="lg" />
              <span aria-hidden="true" className="text-sm font-extrabold text-ink-3">
                0{i + 1}
              </span>
            </span>
            <h3 className="mt-5 text-lg font-bold leading-snug text-ink">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Ten-role executive team grid. */
export function TeamGrid({ headingId = "team-heading" }: { headingId?: string }) {
  return (
    <Section id="team" labelledBy={headingId} className="bg-surface-2/60">
      <SectionHeading
        id={headingId}
        eyebrow="Your AI executive team"
        title="Ten specialists. One shared brain."
        intro="These specialists collaborate through one central intelligence system, not ten separate chatbots. Every plan includes all ten."
      />
      <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((r) => (
          <li key={r.key} className="flex flex-col rounded-xl border border-line bg-surface p-5">
            <RoleAvatar role={ROLE_KEYS[r.key] ?? r.key} size="lg" />
            <h3 className="mt-4 font-bold leading-snug text-ink">{r.title}</h3>
            <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-2">{r.body}</p>
            {r.note ? <p className="mt-2 text-sm text-ink-3">{r.note}</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** A–H capability grid. */
export function CapabilityGrid({ headingId = "capabilities-heading" }: { headingId?: string }) {
  return (
    <Section id="everything" labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow="Everything in one place"
        title="One team for all the growth work"
        intro="Instead of juggling agencies, freelancers and a stack of tools, ClimbOS handles the whole picture — and every piece knows what the others are doing."
      />
      <ul className="mt-12 grid gap-4 md:grid-cols-2">
        {CAPABILITIES.map((c) => (
          <li key={c.letter} className="flex flex-col rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-sm">
            <div className="flex items-baseline gap-3">
              <span aria-hidden="true" className="font-display tracking-tight text-xl font-extrabold text-brand-700">
                {c.letter}
              </span>
              <h3 className="text-xl font-semibold text-ink">{c.title}</h3>
            </div>
            <p className="mt-1.5 text-ink-2">{c.summary}</p>
            <ul className="mt-4 grid gap-x-4 gap-y-1.5 text-[0.95rem] text-ink sm:grid-cols-2">
              {c.items.map((it) => (
                <li key={it} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-600" />
                  {it}
                </li>
              ))}
            </ul>
            {c.note ? (
              <p className="mt-4 rounded-[6px] bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-ink-2">{c.note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

const trustIcons: LucideIcon[] = [ClipboardList, CirclePause, Wallet, Scale, Lock, ReceiptText];

/** "Safe by design" trust section. */
export function TrustSection({ headingId = "trust-heading" }: { headingId?: string }) {
  return (
    <Section id="safe-by-design" labelledBy={headingId} className="bg-brand-950 text-brand-50">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-200">Safe by design</p>
        <h2 id={headingId} className="mt-2 font-display text-[2rem] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[2.6rem]">
          You stay in charge. Always.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-brand-100">
          Growth tools shouldn&apos;t feel risky. These rules are built into how ClimbOS works — not settings you have to find.
        </p>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRUST.map((t, i) => {
          const Icon = trustIcons[i] ?? ShieldCheck;
          return (
            <li key={t.title} className="rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.04] p-6">
              <Icon aria-hidden="true" className="size-6 text-brand-200" />
              <h3 className="mt-4 text-lg font-semibold text-white">{t.title}</h3>
              <p className="mt-2 leading-relaxed text-brand-100">{t.body}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-10">
        <Link href="/security" className="inline-flex min-h-11 items-center gap-2 font-medium text-white underline underline-offset-4">
          How we handle security and your data
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </p>
    </Section>
  );
}

/** Honest list of things ClimbOS refuses to do. */
export function WontDo({ headingId = "wont-heading" }: { headingId?: string }) {
  return (
    <Section id="what-we-wont-do" labelledBy={headingId}>
      <SectionHeading
        id={headingId}
        eyebrow="Straight talk"
        title="What ClimbOS won't do"
        intro="Some shortcuts aren't worth it. ClimbOS is built to refuse them."
      />
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WONT_DO.map((w) => (
          <li key={w.title} className="flex gap-3 rounded-[var(--radius)] border border-line bg-surface p-5">
            <Ban aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-800" />
            <div>
              <h3 className="font-semibold text-ink">{w.title}</h3>
              <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-2">{w.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Compact plan overview linking to /pricing. Numbers come from the entitlement registry. */
export function PricingTeaser({ headingId = "pricing-teaser-heading" }: { headingId?: string }) {
  const plans = getPlans();
  return (
    <Section id="pricing" labelledBy={headingId} className="bg-surface-2/60">
      <SectionHeading
        id={headingId}
        eyebrow="Pricing"
        title={`Plans from ${formatUsd(lowestPrice())} a month`}
        intro="Every plan includes all ten AI roles. Limits are monthly maximums, and nothing is ever charged automatically."
      />
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {plans.map((p) => {
          const recommended = p.key === RECOMMENDED_PLAN;
          return (
            <li
              key={p.key}
              className={cn(
                "flex flex-col rounded-[var(--radius-lg)] border bg-surface p-5",
                recommended ? "border-brand-800 ring-1 ring-brand-800" : "border-line",
              )}
            >
              <h3 className="font-semibold text-ink">{p.name}</h3>
              {recommended ? <p className="mt-1 text-xs font-semibold text-brand-800">Recommended for small teams</p> : null}
              <p className="mt-2">
                <span className="font-display tracking-tight text-3xl font-extrabold text-ink">{formatUsd(p.priceUsd)}</span>
                <span className="text-sm text-ink-3"> / month</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.tagline}</p>
              <p className="mt-3 text-sm text-ink-3">{planLimitLines(p)[1]}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/pricing" className={buttonClasses({ variant: "secondary", size: "lg" })}>
          Compare plans
        </Link>
        <Link href={CTA.start.href} className={buttonClasses({ size: "lg" })}>
          {CTA.start.label}
        </Link>
      </div>
    </Section>
  );
}

/** Accessible FAQ using native disclosure widgets. */
export function Faq({
  items,
  headingId = "faq-heading",
  title = "Questions, answered",
}: {
  items: readonly { q: string; a: ReactNode }[];
  headingId?: string;
  title?: string;
}) {
  return (
    <Section id="faq" labelledBy={headingId}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading id={headingId} eyebrow="FAQ" title={title} />
        <div className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
          {items.map((f) => (
            <details key={f.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-ink">
                <h3 className="text-base font-semibold">{f.q}</h3>
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="pb-5 leading-relaxed text-ink-2">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** Closing call to action. */
export function FinalCta({ headingId = "final-cta-heading" }: { headingId?: string }) {
  return (
    <section aria-labelledby={headingId} className="pb-20 sm:pb-28">
      <Container>
        <div className="rounded-[6px] bg-brand-800 px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 id={headingId} className="mx-auto max-w-2xl font-display tracking-tight text-[2rem] font-extrabold leading-tight text-white sm:text-5xl">
            Ready to see what your growth team would do first?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-brand-100">
            Start with your website. You&apos;ll see a plan before you&apos;re asked to approve anything.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={CTA.start.href}
              className={buttonClasses({ size: "lg", className: "bg-white text-brand-900 hover:bg-brand-50 active:bg-brand-100" })}
            >
              {CTA.start.label}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              href={CTA.demo.href}
              className={buttonClasses({
                variant: "ghost",
                size: "lg",
                className: "border border-white/40 text-white hover:bg-white/10 active:bg-white/15",
              })}
            >
              {CTA.demo.label}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
