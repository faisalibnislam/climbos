"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "@/components/ui";
import { RequestComposer } from "@/components/ui/request-composer";
import { errorInfo } from "@/components/app/errors";
import { wishDraftKey } from "@/components/app/draftKeys";

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
export const WishComposer = forwardRef<WishComposerHandle, { slug: string; userId?: string; identityReady: boolean; suggestions: string[]; disabled?: boolean; disabledReason?: string | null }>(function WishComposer(
  { slug, userId, identityReady, suggestions, disabled, disabledReason }, ref,
) {
  const send = useMutation(api.workspace.sendChat);
  const scope = identityReady && userId ? wishDraftKey(slug, userId) : null;
  const [draft, setDraft] = useState<{ scope: string | null; text: string }>({ scope: null, text: "" });
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const text = draft.scope === scope ? draft.text : "";

  useEffect(() => {
    setLoadedScope(null);
    if (!scope) {
      setDraft({ scope: null, text: "" });
      return;
    }
    let saved = "";
    try { saved = window.sessionStorage.getItem(scope) ?? ""; } catch { /* Storage may be unavailable. */ }
    setDraft({ scope, text: saved });
    setLoadedScope(scope);
  }, [scope]);

  useEffect(() => {
    if (!scope || loadedScope !== scope || draft.scope !== scope) return;
    try {
      if (draft.text.trim()) window.sessionStorage.setItem(scope, draft.text);
      else window.sessionStorage.removeItem(scope);
    } catch { /* The request remains editable if browser storage is unavailable. */ }
  }, [draft, loadedScope, scope]);

  useImperativeHandle(ref, () => ({
    fill: (value) => {
      // A queued request must not discard a draft someone is already writing.
      setDraft((current) => {
        const currentText = current.scope === scope ? current.text : "";
        return { scope, text: currentText.trim() ? `${currentText.trimEnd()}\n${value}` : value };
      });
      requestAnimationFrame(() => area.current?.focus());
    },
  }), [scope]);

  const submit = async () => {
    const request = text.trim();
    if (!request || pending.current || disabled || !scope) return;
    pending.current = true;
    setBusy(true);
    try {
      await send({ slug, text: request });
      setDraft({ scope, text: "" });
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
        onChange={(next) => setDraft({ scope, text: next })}
        onSubmit={() => void submit()}
        placeholder="For example: I want more people to book my services. Where should I start?"
        suggestions={suggestions}
        busy={busy}
        disabled={disabled || !scope}
        helper={!identityReady ? "Checking your account…" : "Your draft stays in this browser tab and this business. Sending can use credits. Publishing, messages, and spending still follow your approval rules."}
      />
      {(disabled || !scope) && disabledReason ? <p role="status" className="text-sm text-ink-3">{disabledReason}</p> : null}
    </section>
  );
});
