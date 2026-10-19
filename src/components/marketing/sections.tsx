import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Ban,
  BarChart3,
  ChevronDown,
  CircleCheck,
  CirclePause,
  ClipboardList,
  Compass,
  Lock,
  MessageSquareText,
  PenTool,
  ReceiptText,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "@/components/icons"
import { buttonClasses } from "@/components/ui/button-styles";
import { IconTile } from "@/components/ui/icon-tile";
import { SocialIcon, type SocialNetwork } from "@/components/ui/social-icon";
import type { Tone } from "@/components/ui/badge";
import { RoleAvatar } from "@/components/app/RoleAvatar";
import { cn, formatUsd } from "@/lib/utils";
import { CAPABILITIES, CTA, ROLES, STEPS, TRUST, WONT_DO } from "./content";
import { Container, Section, SectionHeading } from "./layout";
import { LivePreview } from "./LivePreview";
import { getTiers, lowestPaidPrice, RECOMMENDED_TIER } from "./plans";
import { RecommendedBadge } from "./pricing";

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

/** Networks named in a capability's note, shown as real platform marks (the note text names them). */
const CAPABILITY_NETWORKS: Record<string, SocialNetwork[]> = {
  C: ["facebook", "instagram", "linkedin", "x", "tiktok", "pinterest", "youtube"],
  D: ["google", "facebook", "linkedin"],
};

/** Inline text link used inside marketing copy. */
const textLink = "font-medium text-brand-800 underline underline-offset-4 hover:decoration-2";

/** Landing hero: a flat white showcase panel, serif headline, live preview. */
export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="bg-bg p-3 sm:p-5">
      <div className="rounded-2xl border border-line bg-surface px-4 py-14 sm:py-20">
        <Container className="flex flex-col items-center text-center">
          <p className="inline-flex items-center gap-2 text-overline">
            <span aria-hidden="true" className="size-2 rounded-full bg-sun" />
            Your AI growth team, ready in minutes
          </p>
          <h1 id="hero-heading" className="mt-4 max-w-3xl text-5xl text-ink sm:text-6xl lg:text-7xl">
            Tell us your goal. We&apos;ll help you grow.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-2">
            Ten AI specialists research your business, build the plan, create the work and measure what happens.{" "}
            <strong className="font-semibold text-ink">You approve anything that goes live.</strong>
          </p>
          <div className="mt-10 w-full max-w-2xl text-left">
            <LivePreview />
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-2">
            {[
              "Nothing posts, sends or spends without your OK",
              "Free to start · packages from " + formatUsd(lowestPaidPrice()) + " a month",
              "No sign-up for the preview",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-ink-2">
            Want to look around first?{" "}
            <Link href={CTA.demo.href} className={textLink}>
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
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-xl border border-line bg-surface p-5">
            <span className="flex items-center justify-between">
              <IconTile icon={STEP_ICONS[i] ?? Sparkles} tone={STEP_TONES[i] ?? "brand"} />
              <span aria-hidden="true" className="text-ui font-medium tabular-nums text-ink-3">
                0{i + 1}
              </span>
            </span>
            <h3 className="mt-4 heading-section">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="mt-1.5 text-sm text-ink-2">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Ten-role executive team grid. */
export function TeamGrid({ headingId = "team-heading" }: { headingId?: string }) {
  return (
    <Section id="team" labelledBy={headingId} className="bg-surface">
      <SectionHeading
        id={headingId}
        eyebrow="Your AI executive team"
        title="Ten specialists. One shared brain."
        intro="These specialists collaborate through one central intelligence system, not ten separate chatbots. Every plan includes all ten."
      />
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((r) => (
          <li key={r.key} className="flex flex-col rounded-xl border border-line bg-surface p-5">
            <RoleAvatar role={ROLE_KEYS[r.key] ?? r.key} size="lg" />
            <h3 className="mt-4 heading-section">{r.title}</h3>
            <p className="mt-1.5 text-sm text-ink-2">{r.body}</p>
            {r.note ? <p className="mt-2 text-xs text-ink-3">{r.note}</p> : null}
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
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {CAPABILITIES.map((c) => {
          const networks = CAPABILITY_NETWORKS[c.letter];
          return (
            <li key={c.letter} className="flex flex-col rounded-xl border border-line bg-surface p-5">
              <div className="flex items-baseline gap-2.5">
                <span aria-hidden="true" className="heading-section text-brand-700">
                  {c.letter}
                </span>
                <h3 className="heading-section">{c.title}</h3>
              </div>
              <p className="mt-1.5 text-sm text-ink-2">{c.summary}</p>
              <ul className="mt-4 grid gap-x-4 gap-y-1.5 text-sm text-ink sm:grid-cols-2">
                {c.items.map((it) => (
                  <li key={it} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600" />
                    {it}
                  </li>
                ))}
              </ul>
              {networks ? (
                <div aria-hidden="true" className="mt-4 flex flex-wrap items-center gap-2.5">
                  {networks.map((n) => (
                    <SocialIcon key={n} network={n} size="lg" />
                  ))}
                </div>
              ) : null}
              {c.note ? <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{c.note}</p> : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const trustIcons: LucideIcon[] = [ClipboardList, CirclePause, Wallet, Scale, Lock, ReceiptText];

/** "Safe by design" trust section (the one pine feature section). */
export function TrustSection({ headingId = "trust-heading" }: { headingId?: string }) {
  return (
    <Section id="safe-by-design" labelledBy={headingId} className="bg-brand-950 text-brand-50">
      <SectionHeading
        id={headingId}
        inverse
        eyebrow="Safe by design"
        title="You stay in charge. Always."
        intro="Growth tools shouldn't feel risky. These rules are built into how ClimbOS works — not settings you have to find."
      />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRUST.map((t, i) => {
          const Icon = trustIcons[i] ?? ShieldCheck;
          return (
            <li key={t.title} className="rounded-xl border border-brand-800 bg-brand-900 p-5">
              <Icon aria-hidden="true" className="size-5 text-brand-200" />
              <h3 className="mt-4 heading-section text-white">{t.title}</h3>
              <p className="mt-1.5 text-sm text-brand-100">{t.body}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-10">
        <Link href="/security" className="inline-flex min-h-11 items-center gap-2 text-base font-medium text-white underline underline-offset-4">
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
          <li key={w.title} className="flex gap-3 rounded-xl border border-line bg-surface p-5">
            <Ban aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-800" />
            <div>
              <h3 className="heading-section">{w.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{w.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Compact pricing overview linking to /pricing. Numbers come from the credits registry. */
export function PricingTeaser({ headingId = "pricing-teaser-heading" }: { headingId?: string }) {
  const tiers = getTiers();
  return (
    <Section id="pricing" labelledBy={headingId} className="bg-surface">
      <SectionHeading
        id={headingId}
        eyebrow="Pricing"
        title="Free to start. Pay for the work, in credits."
        intro="Every action shows its credits before it starts and only charges what it used. Nothing is charged automatically."
      />
      <ul className="mt-10 grid gap-3 sm:grid-cols-3">
        {tiers.map((t) => {
          const recommended = t.key === RECOMMENDED_TIER;
          return (
            <li key={t.key} className={cn("relative flex flex-col rounded-xl border bg-surface p-5", recommended ? "border-brand-800 ring-1 ring-brand-800" : "border-line")}>
              {recommended ? <RecommendedBadge /> : null}
              <h3 className="heading-section">{t.name}</h3>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="metric">{t.priceUsd ? formatUsd(t.priceUsd) : "$0"}</span>
                <span className="text-sm text-ink-3">{t.priceUsd ? " / month" : ""}</span>
              </p>
              <p className="mt-2 text-sm font-medium text-brand-800">
                {t.credits.toLocaleString("en-US")} credits {t.creditsNote}
              </p>
              <p className="mt-2 text-sm text-ink-2">{t.tagline}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={CTA.start.href} className={buttonClasses({ size: "lg" })}>
          {CTA.start.label}
        </Link>
        <Link href="/pricing" className={buttonClasses({ variant: "secondary", size: "lg" })}>
          See pricing
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
  className,
}: {
  items: readonly { q: string; a: ReactNode }[];
  headingId?: string;
  title?: string;
  /** Section background override, e.g. "bg-surface" to alternate with the section above. */
  className?: string;
}) {
  return (
    <Section id="faq" labelledBy={headingId} className={className}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading id={headingId} eyebrow="FAQ" title={title} />
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {items.map((f) => (
            <details key={f.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left">
                <h3 className="heading-section">{f.q}</h3>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="pb-5 text-sm text-ink-2">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** Closing call to action on a flat pine panel. */
export function FinalCta({ headingId = "final-cta-heading", className }: { headingId?: string; className?: string }) {
  return (
    <Section labelledBy={headingId} className={className}>
      <div className="rounded-2xl bg-brand-800 px-6 py-12 text-center sm:px-12 sm:py-16">
        <h2 id={headingId} className="mx-auto max-w-2xl text-3xl text-white sm:text-4xl">
          Ready to see what your growth team would do first?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-brand-100">
          Start with your website. You&apos;ll see a plan before you&apos;re asked to approve anything.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={CTA.start.href} className={buttonClasses({ variant: "accent", size: "lg" })}>
            {CTA.start.label}
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href={CTA.demo.href} className={buttonClasses({ variant: "secondary", size: "lg" })}>
            {CTA.demo.label}
          </Link>
        </div>
      </div>
    </Section>
  );
}
