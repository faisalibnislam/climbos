import type { ReactNode } from "react";
import { SiResend, SiStripe, SiWordpress } from "react-icons/si";
import { Contact, FileSpreadsheet, Globe, UserSearch, type LucideIcon } from "@/components/icons";
import { IconTile } from "@/components/ui/icon-tile";
import { SocialIcon } from "@/components/ui/social-icon";
import type { Tone } from "@/components/ui/badge";

const NETWORK: Record<string, string> = {
  website: "website", ga4: "google", search_console: "google", google_ads: "google",
  google_business_profile: "google", meta_ads: "facebook", facebook_pages: "facebook",
  instagram: "instagram", linkedin: "linkedin", x: "x", tiktok: "tiktok",
  pinterest: "pinterest", youtube: "youtube", email_mailbox: "email",
};
const BRAND = {
  stripe_revenue: { Icon: SiStripe, color: "#635BFF" },
  email_resend: { Icon: SiResend, color: "#111111" },
  wordpress: { Icon: SiWordpress, color: "#21759B" },
} as const;
const VISUAL: Record<string, { icon: LucideIcon; tone: Tone }> = {
  csv_revenue: { icon: FileSpreadsheet, tone: "green" },
  crm_csv: { icon: Contact, tone: "teal" },
  enrichment: { icon: UserSearch, tone: "brand" },
};

/** Local brand artwork; decorative beside the visible service name. */
export function ProviderMark({ provider }: { provider: string }) {
  const brand = Object.hasOwn(BRAND, provider) ? BRAND[provider as keyof typeof BRAND] : undefined;
  if (brand) return <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: brand.color }}><brand.Icon size={22} focusable="false" /></span>;
  const network = Object.hasOwn(NETWORK, provider) ? NETWORK[provider] : undefined;
  if (network) return <SocialIcon network={network} variant="tile" size="xl" />;
  const visual = Object.hasOwn(VISUAL, provider) ? VISUAL[provider] : { icon: Globe, tone: "neutral" as Tone };
  return <IconTile icon={visual.icon} tone={visual.tone} size="md" className="size-9" />;
}

/** Shared by connection setup and disconnect dialogs; the accessible title stays text. */
export function ProviderTitle({ provider, children }: { provider: string; children: ReactNode }) {
  return <span className="flex min-w-0 items-center gap-3"><ProviderMark provider={provider} /><span>{children}</span></span>;
}
