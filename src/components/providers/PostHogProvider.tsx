"use client";

import posthog from "posthog-js";
import { useEffect, type ReactNode } from "react";

/**
 * ClimbOS product analytics. Only loads when NEXT_PUBLIC_POSTHOG_KEY is set.
 * Session replay and autocapture of inputs are disabled; customer data is never sent.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "identified_only",
      disable_session_recording: true,
      autocapture: { dom_event_allowlist: ["click"], element_allowlist: ["a", "button"] },
      mask_all_text: true,
      capture_pageview: "history_change",
    });
  }, []);
  return <>{children}</>;
}
