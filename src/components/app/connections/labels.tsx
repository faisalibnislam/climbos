import { Ban, CircleAlert, CircleCheck, CircleMinus, Clock, Hourglass, Settings2, TriangleAlert } from "@/components/icons"
import type { ReactNode } from "react";
import type { Tone } from "@/components/ui";

export type CapabilityState =
  | "ready"
  | "approval_needed"
  | "provider_review_pending"
  | "unsupported_account_type"
  | "sync_delayed"
  | "action_required"
  | "setup_needed"
  | "unavailable";

/** Plain labels per capability state. Icon + text always; color is supportive only. */
export const CAPABILITY_STATE: Record<CapabilityState, { label: string; tone: Tone; icon: ReactNode }> = {
  ready: { label: "Ready", tone: "green", icon: <CircleCheck /> },
  approval_needed: { label: "Approval needed to publish", tone: "amber", icon: <Hourglass /> },
  provider_review_pending: { label: "Provider review pending", tone: "blue", icon: <Clock /> },
  unsupported_account_type: { label: "Unsupported account type", tone: "amber", icon: <Ban /> },
  sync_delayed: { label: "Sync delayed", tone: "amber", icon: <TriangleAlert /> },
  action_required: { label: "Action required", tone: "red", icon: <CircleAlert /> },
  setup_needed: { label: "Setup needed", tone: "neutral", icon: <Settings2 /> },
  unavailable: { label: "Not available", tone: "neutral", icon: <CircleMinus /> },
};

export const CONNECTION_STATUS: Record<string, { label: string; tone: Tone; icon: ReactNode }> = {
  connected: { label: "Connected", tone: "green", icon: <CircleCheck /> },
  connecting: { label: "Connecting…", tone: "blue", icon: <Clock /> },
  action_required: { label: "Action required", tone: "red", icon: <CircleAlert /> },
  expired: { label: "Access expired", tone: "red", icon: <CircleAlert /> },
  not_connected: { label: "Not connected", tone: "neutral", icon: <CircleMinus /> },
  revoked: { label: "Disconnected", tone: "neutral", icon: <CircleMinus /> },
};

export type Group = "measure" | "publish" | "advertise" | "email" | "revenue" | "data";

export const GROUPS: { key: Group; title: string; intro: string }[] = [
  { key: "measure", title: "Measure results", intro: "Where ClimbOS reads visits, sign-ups and search performance." },
  { key: "publish", title: "Publish posts", intro: "Social accounts ClimbOS can post to after you approve, or prepare posts for." },
  { key: "advertise", title: "Run ads", intro: "Ad accounts. New ads are always created paused and need your approval." },
  { key: "email", title: "Email marketing", intro: "Your own email provider, so messages come from your account and domain." },
  { key: "revenue", title: "Revenue", intro: "Billing data is the source of truth for revenue and paying customers." },
  { key: "data", title: "Customer and lead data", intro: "Contacts you already have and are allowed to reach." },
];

export const SYNCABLE = new Set(["ga4", "stripe_revenue"]);

/** True when the timestamp is in the past (kept out of render bodies for purity lint). */
export function isPast(ms: number): boolean {
  return ms < Date.now();
}
