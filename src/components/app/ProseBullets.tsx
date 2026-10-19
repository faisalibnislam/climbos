"use client";

/*
 * AI prose as scannable content. Kept as a thin wrapper so existing imports work;
 * the logic lives in the design-system content blocks (docs/ContentDesign.md).
 */
import { Scannable, toBullets } from "@/components/ds/content";

export { toBullets };

export function ProseBullets({ text, max = 3, className, tone = "default", expanded }: { text: string; max?: number; className?: string; tone?: "default" | "muted"; expanded?: boolean }) {
  return <Scannable text={text} max={max} className={className} tone={tone} expanded={expanded} />;
}
