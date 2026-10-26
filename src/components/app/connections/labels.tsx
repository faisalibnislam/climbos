import { Ban, CircleAlert, CircleCheck, CircleMinus, Clock, FlaskConical, Hourglass, Settings2, TriangleAlert } from "@/components/icons"
import type { ReactNode } from "react";
import type { Tone } from "@/components/ui";

export type CapabilityState =
  | "ready"
  | "testing_access"
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
  testing_access: { label: "Testing mode", tone: "blue", icon: <FlaskConical /> },
  approval_needed: { label: "Needs approval", tone: "amber", icon: <Hourglass /> },
  provider_review_pending: { label: "Provider review pending", tone: "blue", icon: <Clock /> },
  unsupported_account_type: { label: "Unsupported account", tone: "amber", icon: <Ban /> },
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
  { key: "measure", title: "Measure results", intro: "Visits, sign-ups, search." },
  { key: "publish", title: "Publish posts", intro: "Posts go out after you approve." },
  { key: "advertise", title: "Run ads", intro: "New ads start paused." },
  { key: "email", title: "Email marketing", intro: "Sends from your domain." },
  { key: "revenue", title: "Revenue", intro: "Source of truth for revenue." },
  { key: "data", title: "Customer and lead data", intro: "Contacts you may reach." },
];

export const SYNCABLE = new Set(["ga4", "stripe_revenue"]);

/** True when the timestamp is in the past (kept out of render bodies for purity lint). */
export function isPast(ms: number): boolean {
  return ms < Date.now();
}
