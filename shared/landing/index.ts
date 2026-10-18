import { z } from "zod";

/** Landing page content: what Climb AI writes and the owner edits. */
export const LandingContent = z.object({
  headline: z.string(),
  subhead: z.string(),
  benefits: z.array(z.object({ title: z.string(), text: z.string() })),
  steps: z.array(z.string()),
  proof: z.string(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  ctaLabel: z.string(),
  formIntro: z.string(),
});
export type LandingContent = z.infer<typeof LandingContent>;

/** Clamp lengths so a page always renders well (also used on owner edits). */
export function cleanLanding(c: LandingContent): LandingContent {
  const t = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
  return {
    headline: t(c.headline, 90),
    subhead: t(c.subhead, 220),
    benefits: c.benefits.slice(0, 6).map((b) => ({ title: t(b.title, 60), text: t(b.text, 220) })).filter((b) => b.title),
    steps: c.steps.slice(0, 4).map((s) => t(s, 140)).filter(Boolean),
    proof: t(c.proof, 300),
    faq: c.faq.slice(0, 6).map((f) => ({ q: t(f.q, 120), a: t(f.a, 400) })).filter((f) => f.q && f.a),
    ctaLabel: t(c.ctaLabel, 32) || "Get in touch",
    formIntro: t(c.formIntro, 160),
  };
}

export function landingSlug(title: string, suffix: string): string {
  const base = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "page";
  return `${base}-${suffix}`;
}
