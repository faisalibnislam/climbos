import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  /** Accepted for lucide compatibility. */
  absoluteStrokeWidth?: boolean;
}

export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
/** Kept so existing `type LucideIcon` annotations keep working. */
export type LucideIcon = Icon;
