import type { IconType } from "react-icons";
import {
  FaFacebook,
  FaGoogle,
  FaInstagram,
  FaLinkedin,
  FaPinterest,
  FaSnapchat,
  FaThreads,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { Globe, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Real platform marks (Font Awesome brands, CC BY 4.0) in their brand colours.
 * Use wherever a channel or network appears: lists, calendars, filters,
 * connection cards, charts. Text next to the icon must still name the
 * channel (or pass `labelled` to expose the name to screen readers).
 */
export type SocialNetwork =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "snapchat"
  | "threads"
  | "google"
  | "email"
  | "website";

const NETWORKS: Record<SocialNetwork, { name: string; Icon: IconType | typeof Mail; color: string; tile: string }> = {
  instagram: { name: "Instagram", Icon: FaInstagram, color: "#E1306C", tile: "linear-gradient(45deg,#F58529 0%,#DD2A7B 45%,#8134AF 75%,#515BD4 100%)" },
  facebook: { name: "Facebook", Icon: FaFacebook, color: "#1877F2", tile: "#1877F2" },
  linkedin: { name: "LinkedIn", Icon: FaLinkedin, color: "#0A66C2", tile: "#0A66C2" },
  x: { name: "X", Icon: FaXTwitter, color: "#0F1419", tile: "#0F1419" },
  tiktok: { name: "TikTok", Icon: FaTiktok, color: "#0F1419", tile: "#0F1419" },
  youtube: { name: "YouTube", Icon: FaYoutube, color: "#FF0000", tile: "#FF0000" },
  pinterest: { name: "Pinterest", Icon: FaPinterest, color: "#E60023", tile: "#E60023" },
  snapchat: { name: "Snapchat", Icon: FaSnapchat, color: "#0F1419", tile: "#FFFC00" },
  threads: { name: "Threads", Icon: FaThreads, color: "#0F1419", tile: "#0F1419" },
  google: { name: "Google", Icon: FaGoogle, color: "#4285F4", tile: "#4285F4" },
  email: { name: "Email", Icon: Mail, color: "#434B47", tile: "#434B47" },
  website: { name: "Website", Icon: Globe, color: "#434B47", tile: "#434B47" },
};

/** Map product channel values (meta_ad, google_search_ad, blog…) onto a network mark. */
export function networkOf(channel: string): SocialNetwork | null {
  if (channel in NETWORKS) return channel as SocialNetwork;
  if (channel === "meta_ad") return "facebook";
  if (channel === "linkedin_ad") return "linkedin";
  if (channel === "google_search_ad") return "google";
  if (channel === "blog") return "website";
  return null;
}

export function networkName(channel: string): string {
  const n = networkOf(channel);
  return n ? NETWORKS[n].name : channel;
}

const SIZES = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 } as const;

export interface SocialIconProps {
  network: string;
  size?: keyof typeof SIZES;
  /** "mark": coloured glyph (default). "tile": white glyph on a brand-coloured rounded tile. "mono": inherits text colour. */
  variant?: "mark" | "tile" | "mono";
  /** Expose the network name to assistive tech (when no visible text names it). */
  labelled?: boolean;
  className?: string;
}

export function SocialIcon({ network, size = "md", variant = "mark", labelled = false, className }: SocialIconProps) {
  const key = networkOf(network) ?? "website";
  const { name, Icon, color, tile } = NETWORKS[key];
  const px = SIZES[size];
  const a11y = labelled ? { role: "img" as const, "aria-label": name } : { "aria-hidden": true as const };
  if (variant === "tile") {
    const box = px + (size === "xs" ? 8 : 12);
    return (
      <span
        {...a11y}
        className={cn("inline-grid shrink-0 place-items-center rounded-lg", key === "snapchat" ? "text-ink" : "text-white", className)}
        style={{ width: box, height: box, background: tile }}
      >
        <Icon size={px} />
      </span>
    );
  }
  return (
    <span {...a11y} className={cn("inline-flex shrink-0", className)} style={variant === "mark" ? { color } : undefined}>
      <Icon size={px} />
    </span>
  );
}

/** A network mark followed by its name. */
export function NetworkLabel({ network, size = "sm", className }: { network: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <SocialIcon network={network} size={size} />
      <span>{networkName(network)}</span>
    </span>
  );
}

