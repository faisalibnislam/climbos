"use client";

import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";
import { Tooltip } from "./menu";

export type { ButtonSize, ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
  /** Optional text announced/visible while loading (defaults to children). */
  loadingText?: ReactNode;
  /** Render the single child element (e.g. next/link) with button styling. */
  asChild?: boolean;
}

/**
 * Primary action control. Variants: primary, secondary, ghost, danger, link.
 * Use `asChild` to style a `<Link>`; use `loading` for async work.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, loadingText, asChild = false, className, children, disabled, type, ...props },
  ref,
) {
  const classes = buttonClasses({ variant, size, className });
  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "children" | "loadingText" | "aria-label"> {
  /** Required: icon-only buttons must have an accessible name. */
  "aria-label": string;
  icon: ReactNode;
  /** Hover/focus hint. Defaults to the aria-label; pass `false` to turn it off (e.g. inside a menu trigger that already explains itself). */
  tooltip?: ReactNode | false;
}

/**
 * Square icon-only button, same heights as Button (32/36/40). `aria-label` is
 * required and doubles as a hover/focus tooltip so icons are never a guess.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = "md", variant = "ghost", className, tooltip, ...props },
  ref,
) {
  const square = size === "sm" ? "w-8 px-0" : size === "lg" ? "w-10 px-0" : "w-9 px-0";
  const button = (
    <Button ref={ref} size={size} variant={variant} className={cn(square, className)} {...props}>
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
    </Button>
  );
  if (tooltip === false) return button;
  return <Tooltip content={tooltip ?? props["aria-label"]}>{button}</Tooltip>;
});
