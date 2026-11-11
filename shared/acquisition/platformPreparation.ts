import { z } from "zod";
export const PlatformKindSchema = z.enum(["product_hunt", "google_business", "g2"]);
export type PlatformKind = z.infer<typeof PlatformKindSchema>;
export const PlatformPreparationSchema = z.object({
  audience: z.string().trim().min(4).max(600),
  evidence: z.string().trim().min(4).max(1200),
  destination: z.string().url().max(1000).refine((value) => { try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; } }, "Use an HTTPS URL without credentials."),
  accountControl: z.enum(["unknown", "confirmed"]),
  eligibility: z.enum(["unknown", "confirmed", "ineligible"]),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(4).max(2400),
  makerComment: z.string().trim().max(2400),
  measurement: z.string().trim().min(4).max(1000),
});
export type PlatformPreparation = z.infer<typeof PlatformPreparationSchema>;
export const PLATFORM_PREPARATION: Record<PlatformKind, { name: string; purpose: string; evidenceHint: string; control: string; boundary: string; source: string }> = {
  product_hunt: { name: "Product Hunt launch", purpose: "Test a new product or major update with relevant makers and early adopters. Explain one useful customer job and what changed; launch feedback is not predictable demand.", evidenceHint: "Which recent products, discussions or owner conversations suggest these people have this problem? Include URLs and dates, or say unknown.", control: "A maker controls the personal account and can respond to genuine questions.", boundary: "Prepare the product link, truthful description, demonstration images and maker comment. Recheck current launch requirements. Publish manually after reviewing the exact draft. No automated votes, upvote requests, paid hunting, mass messages or launch publication.", source: "https://help.producthunt.com/en/articles/17350772-launch-guide" },
  google_business: { name: "Google Business Profile", purpose: "Help customers find and assess an eligible local business. Start with the real location or service area and the job customers come for.", evidenceHint: "Do customers search locally for this service? Record the real service area and evidence of customer use. Online-only businesses are generally ineligible.", control: "The owner controls or is authorized to manage this exact business profile.", boundary: "Check eligibility and verify ownership through Google. Review the name, category, hours, service area and public contact details manually. Do not invent locations or edit a profile from this screen. Review invitations must treat eligible customers equally; no incentives or rating-based selection.", source: "https://support.google.com/business/answer/13763036" },
  g2: { name: "G2 software profile", purpose: "Help a relevant software buyer compare the product in the right category. A review count is not a customer acquisition forecast.", evidenceHint: "Name the software category and evidence that your buyer actually consults it. Record relevant comparison pages or buyer conversations with dates.", control: "The owner is authorized to manage the exact vendor profile.", boundary: "Verify the category and current vendor terms directly with G2. Copy accurate profile details manually. This app does not sync reviews or post replies here. Invite all eligible customers fairly, without incentives, sentiment selection or reviews written on their behalf.", source: "https://documentation.g2.com/docs/in-app-review-prompts" },
};
export const platformForChannel = (id: string): PlatformKind | null => id === "M10" ? "product_hunt" : id === "S04" ? "google_business" : id === "M11" ? "g2" : null;
