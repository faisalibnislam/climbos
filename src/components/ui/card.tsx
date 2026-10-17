import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** White panel with a hairline border and 8px corners (no shadow). Compose with CardHeader/CardContent/CardFooter. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface", className)} {...props} />
  );
}

/** Top area of a card: title, description and optional actions. */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-0", className)} {...props} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Heading level so card titles keep document outline order. Default h3. */
  as?: "h2" | "h3" | "h4";
}

/** Card heading. Choose `as` to fit the page's heading order. */
export function CardTitle({ as: Tag = "h3", className, ...props }: CardTitleProps) {
  return <Tag className={cn("heading-card", className)} {...props} />;
}

/** Secondary text under a card title. */
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-ui text-ink-3", className)} {...props} />;
}

/** Main card body. */
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

/** Bottom row for actions or meta information. */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 border-t border-line px-5 py-3", className)}
      {...props}
    />
  );
}
