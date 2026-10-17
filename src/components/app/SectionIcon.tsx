import { BarChart3, CalendarDays, Compass, Home, Plug, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { IconTile, type Tone } from "@/components/ui";

/** The icon and colour of each app section, shared by the sidebar and page headers. */
export const SECTION_VISUAL: Record<string, { icon: LucideIcon; tone: Tone }> = {
  today: { icon: Home, tone: "brand" },
  plan: { icon: Compass, tone: "violet" },
  content: { icon: CalendarDays, tone: "pink" },
  results: { icon: BarChart3, tone: "teal" },
  connections: { icon: Plug, tone: "orange" },
  settings: { icon: Settings, tone: "neutral" },
  ops: { icon: ShieldCheck, tone: "red" },
};

export function SectionIcon({ section, size = "lg" }: { section: keyof typeof SECTION_VISUAL | string; size?: "md" | "lg" }) {
  const v = SECTION_VISUAL[section] ?? SECTION_VISUAL.today;
  return <IconTile icon={v.icon} tone={v.tone} size={size} />;
}
