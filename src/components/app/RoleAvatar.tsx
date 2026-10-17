import { BarChart3, Crown, HandCoins, HeartHandshake, Megaphone, Palette, Search, Share2, Target, Workflow, type LucideIcon } from "lucide-react";
import { IconTile, type Tone } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ROLE_META } from "./roles";

/** Each AI teammate's icon and colour, used everywhere the role appears. */
export const ROLE_VISUAL: Record<string, { icon: LucideIcon; tone: Tone }> = {
  ceo: { icon: Crown, tone: "brand" },
  coo: { icon: Workflow, tone: "blue" },
  cmo: { icon: Megaphone, tone: "violet" },
  cso: { icon: HandCoins, tone: "green" },
  creative_director: { icon: Palette, tone: "pink" },
  social_media_manager: { icon: Share2, tone: "orange" },
  ads_manager: { icon: Target, tone: "red" },
  seo_specialist: { icon: Search, tone: "teal" },
  data_analyst: { icon: BarChart3, tone: "blue" },
  customer_success_manager: { icon: HeartHandshake, tone: "amber" },
};

export function RoleAvatar({ role, size = "sm", className }: { role: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const v = ROLE_VISUAL[role] ?? { icon: Crown, tone: "brand" as Tone };
  return <IconTile icon={v.icon} tone={v.tone} size={size} className={cn("rounded-full", className)} />;
}

/** Overlapping avatars for the roles that worked on something, with the names for screen readers. */
export function RoleStack({ roles, size = "xs" }: { roles: string[]; size?: "xs" | "sm" }) {
  return (
    <span className="inline-flex items-center">
      <span className="sr-only">{roles.map((r) => ROLE_META[r]?.title ?? r).join(", ")}</span>
      {roles.map((r, i) => (
        <RoleAvatar key={r} role={r} size={size} className={cn("ring-2 ring-surface", i > 0 && "-ml-1.5")} />
      ))}
    </span>
  );
}
