"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { toast } from "@/components/ui";
import { RequestComposer } from "@/components/ui/request-composer";
import { errorInfo } from "@/components/app/errors";

export interface WishComposerHandle {
  fill: (text: string) => void;
}

/** Everyday requests, not platform recommendations or promised outcomes. */
export function wishSuggestions(_type?: string | null): string[] {
  return [
    "Help me choose what to do next",
    "Prepare posts for next week",
    "Help me find more customers",
    "Explain my recent results",
  ];
}

/** Uses the existing costed work flow; inserting a suggestion never starts it. */
export const WishComposer = forwardRef<WishComposerHandle, { slug: string; suggestions: string[]; disabled?: boolean; disabledReason?: string | null }>(function WishComposer(
  { slug, suggestions, disabled, disabledReason }, ref,
) {
  const send = useMutation(api.workspace.sendChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({
    fill: (value) => {
      // A queued request must not discard a draft someone is already writing.
      setText((current) => current.trim() ? `${current.trimEnd()}\n${value}` : value);
      requestAnimationFrame(() => area.current?.focus());
    },
  }));

  const submit = async () => {
    const request = text.trim();
    if (!request || pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    try {
      await send({ slug, text: request });
      setText("");
    } catch (error) {
      toast({ tone: "danger", title: errorInfo(error).message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="request-heading" className="space-y-3">
      <h2 id="request-heading" className="heading-section">What would you like help with?</h2>
      <p className="text-sm text-ink-3">Use your own words. You do not need to know marketing or business terms.</p>
      <RequestComposer
        label="Your request"
        inputRef={area}
        value={text}
        onChange={setText}
        onSubmit={() => void submit()}
        placeholder="For example: I want more people to book my services. Where should I start?"
        suggestions={suggestions}
        busy={busy}
        disabled={disabled}
        helper="Sending can use credits for research or drafts. Publishing, sending messages, and spending follow your approval rules."
      />
      {disabled && disabledReason ? <p role="status" className="text-sm text-ink-3">{disabledReason}</p> : null}
    </section>
  );
});
