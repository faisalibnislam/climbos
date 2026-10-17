"use client";

import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";

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
}

/** Square icon-only button (44×44 at md). `aria-label` is required. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = "md", variant = "ghost", className, ...props },
  ref,
) {
  const square = size === "sm" ? "w-9 px-0" : size === "lg" ? "w-13 px-0" : "w-11 px-0";
  return (
    <Button ref={ref} size={size} variant={variant} className={cn(square, className)} {...props}>
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
    </Button>
  );
});
