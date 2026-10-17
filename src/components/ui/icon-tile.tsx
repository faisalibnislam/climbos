import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "./badge";

const tileTones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  brand: "bg-lime-soft text-black",
  teal: "bg-teal-100 text-teal-800",
  pink: "bg-pink-100 text-pink-800",
  orange: "bg-orange-100 text-orange-800",
};

const solidTones: Record<Tone, string> = {
  neutral: "bg-ink-2 text-white",
  green: "bg-green-500 text-white",
  amber: "bg-amber-500 text-white",
  red: "bg-red-500 text-white",
  blue: "bg-blue-500 text-white",
  violet: "bg-violet-500 text-white",
  brand: "bg-black text-lime",
  teal: "bg-teal-500 text-white",
  pink: "bg-pink-500 text-white",
  orange: "bg-orange-500 text-white",
};

const sizes = {
  xs: "size-6 rounded-md [&_svg]:size-3.5",
  sm: "size-8 rounded-md [&_svg]:size-4",
  md: "size-10 rounded-lg [&_svg]:size-5",
  lg: "size-12 rounded-xl [&_svg]:size-6",
  xl: "size-16 rounded-2xl [&_svg]:size-8",
};

/** A coloured rounded square holding an icon: the main visual unit of the Bright UI. Decorative. */
export function IconTile({
  icon: Icon,
  tone = "brand",
  size = "md",
  solid = false,
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: keyof typeof sizes;
  solid?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center", sizes[size], solid ? solidTones[tone] : tileTones[tone], className)}>
      <Icon />
    </span>
  );
}
