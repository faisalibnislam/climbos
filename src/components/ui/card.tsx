import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Surface container with a restrained border. Compose with CardHeader/CardContent/CardFooter. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-line bg-surface shadow-sm", className)} {...props} />
  );
}

/** Top area of a card: title, description and optional actions. */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-5 pb-0 sm:p-6 sm:pb-0", className)} {...props} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Heading level so card titles keep document outline order. Default h3. */
  as?: "h2" | "h3" | "h4";
}

/** Card heading. Choose `as` to fit the page's heading order. */
export function CardTitle({ as: Tag = "h3", className, ...props }: CardTitleProps) {
  return <Tag className={cn("text-lg font-semibold leading-snug tracking-tight text-ink", className)} {...props} />;
}

/** Secondary text under a card title. */
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[0.95rem] leading-relaxed text-ink-2", className)} {...props} />;
}

/** Main card body. */
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

/** Bottom row for actions or meta information. */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-6", className)}
      {...props}
    />
  );
}
