"use client";

import { AlertDialog, Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { buttonClasses } from "./button-styles";

const overlayClasses =
  "fixed inset-0 z-50 bg-[rgb(26_29_27/0.42)] data-[state=open]:animate-[climb-fade-in_160ms_ease-out]";

/** Modal dialog root (Radix). Compose with DialogTrigger + DialogContent. */
export const Dialog = RDialog.Root;
/** Element that opens the dialog; use `asChild` with a Button. */
export const DialogTrigger = RDialog.Trigger;
/** Closes the dialog; use `asChild` with a Button. */
export const DialogClose = RDialog.Close;

export interface DialogContentProps extends Omit<ComponentProps<typeof RDialog.Content>, "title"> {
  /** Required visible title (announced when the dialog opens). */
  title: ReactNode;
  description?: ReactNode;
  /** Hide the top-right close button (Escape still closes). */
  hideClose?: boolean;
}

/** Centered modal panel with title, optional description and a close button. Focus is trapped. */
export function DialogContent({ title, description, hideClose, className, children, ...props }: DialogContentProps) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className={overlayClasses} />
      <RDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto",
          "rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-lg animate-fade-up",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <RDialog.Title className="font-display text-xl font-semibold leading-snug text-ink">{title}</RDialog.Title>
          {hideClose ? null : (
            <RDialog.Close
              className={buttonClasses({ variant: "ghost", size: "sm", className: "-mr-2 -mt-1 w-9 px-0" })}
              aria-label="Close"
            >
              <X aria-hidden="true" />
            </RDialog.Close>
          )}
        </div>
        {description ? (
          <RDialog.Description className="mt-2 leading-relaxed text-ink-2">{description}</RDialog.Description>
        ) : null}
        <div className="mt-4">{children}</div>
      </RDialog.Content>
    </RDialog.Portal>
  );
}

/** Right-aligned action row for dialogs; stacks on mobile. */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export interface ConfirmDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional trigger element (rendered with asChild). */
  trigger?: ReactNode;
  title: ReactNode;
  /** Plain-language consequences of confirming. */
  description: ReactNode;
  /**
   * Required explicit action text, e.g. "Publish 3 posts" or "Pause all activity".
   * Never "OK" or "Yes".
   */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  /** May return a promise; the button shows a loading state until it settles. */
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}

/**
 * Confirmation step for consequential actions (Radix AlertDialog).
 * Focus starts on Cancel; the confirm button states exactly what will happen.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (busy) return;
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClasses} />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-lg animate-fade-up">
          <AlertDialog.Title className="font-display text-xl font-semibold leading-snug text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 leading-relaxed text-ink-2">{description}</AlertDialog.Description>
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={busy}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setInternalOpen(false);
                  onOpenChange?.(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export interface SheetProps extends Omit<ComponentProps<typeof RDialog.Root>, "children"> {
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Edge the panel slides from. Default "right". "bottom" works well as a mobile drawer. */
  side?: "right" | "left" | "bottom";
  /** Visually hide the title (it is still announced). */
  hideTitle?: boolean;
  className?: string;
  children: ReactNode;
}

const sideClasses = {
  right: "inset-y-0 right-0 h-dvh w-[min(24rem,calc(100vw-2.5rem))] border-l",
  left: "inset-y-0 left-0 h-dvh w-[min(24rem,calc(100vw-2.5rem))] border-r",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-[var(--radius-lg)] border-t",
};

/** Side or bottom drawer built on Radix Dialog — used for mobile menus and detail panels. */
export function Sheet({ trigger, title, description, side = "right", hideTitle, className, children, ...rootProps }: SheetProps) {
  return (
    <RDialog.Root {...rootProps}>
      {trigger ? <RDialog.Trigger asChild>{trigger}</RDialog.Trigger> : null}
      <RDialog.Portal>
        <RDialog.Overlay className={overlayClasses} />
        <RDialog.Content
          className={cn(
            "fixed z-50 flex flex-col overflow-y-auto border-line bg-bg p-5 shadow-lg animate-fade-up",
            sideClasses[side],
            className,
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-center justify-between gap-4">
            <RDialog.Title className={cn("text-lg font-semibold text-ink", hideTitle && "sr-only")}>{title}</RDialog.Title>
            <RDialog.Close
              className={buttonClasses({ variant: "ghost", className: "ml-auto w-11 px-0" })}
              aria-label="Close"
            >
              <X aria-hidden="true" />
            </RDialog.Close>
          </div>
          {description ? (
            <RDialog.Description className="mt-1 text-sm text-ink-2">{description}</RDialog.Description>
          ) : null}
          <div className="mt-3 flex-1">{children}</div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** Re-export for closing a Sheet from inside (e.g. after a nav link click). */
export const SheetClose = RDialog.Close;
