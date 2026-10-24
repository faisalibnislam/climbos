/**
 * Pure policy logic shared by Convex functions and tests: roles and
 * permissions, the job state machine, canonical hashing for approvals, and
 * approval validity checks. No I/O here.
 */

export type MemberRole = "owner" | "admin" | "editor" | "reviewer" | "viewer";

export const ROLE_RANK: Record<MemberRole, number> = {
  viewer: 0,
  reviewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export type Permission =
  | "view"
  | "chat"
  | "edit"
  | "approve"
  | "pause"
  | "resume"
  | "manage_connections"
  | "manage_policies"
  | "manage_billing"
  | "manage_team"
  | "export"
  | "delete_workspace";

/** Which roles hold each permission. Operators are separate and never derive from these. */
export const PERMISSIONS: Record<Permission, readonly MemberRole[]> = {
  view: ["owner", "admin", "editor", "reviewer", "viewer"],
  chat: ["owner", "admin", "editor"],
  edit: ["owner", "admin", "editor"],
  approve: ["owner", "admin", "reviewer"],
  pause: ["owner", "admin", "editor", "reviewer"],
  resume: ["owner", "admin"],
  manage_connections: ["owner", "admin"],
  manage_policies: ["owner", "admin"],
  manage_billing: ["owner", "admin"],
  manage_team: ["owner", "admin"],
  export: ["owner", "admin"],
  delete_workspace: ["owner"],
};

export function can(role: MemberRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: "Full control, including billing and deleting the workspace.",
  admin: "Manages team, connections, policies and billing.",
  editor: "Creates and edits plans and content. Cannot approve.",
  reviewer: "Approves or rejects work before it goes live.",
  viewer: "Can see everything, change nothing.",
};

/* ------------------------------------------------------------------ */
/* Job state machine                                                    */
/* ------------------------------------------------------------------ */

export type RunStatus =
  | "proposed"
  | "cost_reserved"
  | "preparing"
  | "needs_approval"
  | "approved"
  | "scheduled"
  | "executing"
  | "verified"
  | "failed"
  | "uncertain"
  | "paused"
  | "canceled";

const TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  proposed: ["cost_reserved", "failed", "canceled", "paused"],
  cost_reserved: ["preparing", "failed", "canceled", "paused"],
  preparing: ["needs_approval", "verified", "failed", "uncertain", "canceled", "paused"],
  needs_approval: ["approved", "canceled", "paused", "failed"],
  approved: ["scheduled", "executing", "canceled", "paused", "needs_approval"],
  scheduled: ["executing", "canceled", "paused", "needs_approval"],
  executing: ["verified", "failed", "uncertain", "paused"],
  verified: [],
  failed: [],
  uncertain: ["verified", "failed"],
  paused: ["proposed", "cost_reserved", "preparing", "needs_approval", "canceled"],
  canceled: [],
};

export const TERMINAL_STATUSES: readonly RunStatus[] = ["verified", "failed", "canceled"];

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid workflow transition: ${from} → ${to}`);
  }
}

/* ------------------------------------------------------------------ */
/* Canonical hashing                                                    */
/* ------------------------------------------------------------------ */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

/** Deterministic JSON: sorted keys, undefined dropped, no whitespace. */
export function canonicalJson(value: Json | undefined): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite number in canonical JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Material fields of a content version. Any change invalidates approvals. */
export interface MaterialContent {
  headline?: string;
  body: string;
  contentAngle?: string;
  copyBrief?: Json;
  callToAction?: string;
  destinationUrl?: string;
  hashtags: string[];
  altText?: string;
  imageRef?: string;
  channel: string;
}

export function contentHash(content: MaterialContent): Promise<string> {
  return sha256Hex(
    canonicalJson({
      headline: content.headline?.trim(),
      body: content.body.trim(),
      contentAngle: content.contentAngle?.trim(),
      copyBrief: content.copyBrief,
      callToAction: content.callToAction?.trim(),
      destinationUrl: content.destinationUrl?.trim(),
      hashtags: [...content.hashtags].map((h) => h.trim().toLowerCase()).sort(),
      altText: content.altText?.trim(),
      imageRef: content.imageRef,
      channel: content.channel,
    }),
  );
}

export interface ApprovalScope {
  connectionId?: string;
  destination?: string;
  audience?: string;
  spendLimitMinor?: number;
  currency?: string;
  windowStart?: number;
  windowEnd?: number;
}

export interface ApprovalBinding {
  orgId: string;
  subjectType: string;
  subjectId: string;
  actionKind: string;
  contentHash: string;
  scope: ApprovalScope;
  policyVersion: number;
  expiresAt: number;
}

/** Hash binding an approval to exactly what was approved. */
export function approvalHash(binding: ApprovalBinding): Promise<string> {
  return sha256Hex(canonicalJson(binding as unknown as Json));
}

export type ApprovalCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_approved"
        | "expired"
        | "content_changed"
        | "scope_changed"
        | "policy_changed"
        | "emergency_stop"
        | "capability_unavailable"
        | "wrong_account";
      message: string;
    };

/**
 * Re-checked immediately before execution. Approval must still be "approved",
 * unexpired, and its hash must equal the hash of the CURRENT content, scope
 * and policy. Emergency stop and capability state are checked independently.
 */
export async function checkApprovalForExecution(params: {
  approval: { status: string; approvalHash: string; expiresAt: number; scope: ApprovalScope; contentHash: string; policyVersion: number };
  current: ApprovalBinding;
  now: number;
  emergencyStop: boolean;
  capabilityReady: boolean;
}): Promise<ApprovalCheck> {
  const { approval, current, now } = params;
  if (params.emergencyStop) {
    return { ok: false, reason: "emergency_stop", message: "All activity is paused. Resume activity before anything can go live." };
  }
  if (approval.status !== "approved") {
    return { ok: false, reason: "not_approved", message: "This needs approval before it can run." };
  }
  if (approval.expiresAt <= now) {
    return { ok: false, reason: "expired", message: "The approval expired. Please review it again." };
  }
  if (approval.contentHash !== current.contentHash) {
    return { ok: false, reason: "content_changed", message: "The content changed after it was approved. Please approve the new version." };
  }
  if (approval.scope.connectionId && current.scope.connectionId && approval.scope.connectionId !== current.scope.connectionId) {
    return { ok: false, reason: "wrong_account", message: "This would go to a different account than the one approved." };
  }
  if (canonicalJson(approval.scope as Json) !== canonicalJson(current.scope as Json)) {
    return { ok: false, reason: "scope_changed", message: "The audience, destination, budget or timing changed after approval." };
  }
  if (approval.policyVersion !== current.policyVersion) {
    return { ok: false, reason: "policy_changed", message: "Your approval rules changed since this was approved. Please review it again." };
  }
  if (!params.capabilityReady) {
    return { ok: false, reason: "capability_unavailable", message: "The connected account can't do this right now. Check Connections." };
  }
  const expected = await approvalHash({ ...current, expiresAt: approval.expiresAt });
  if (expected !== approval.approvalHash) {
    return { ok: false, reason: "scope_changed", message: "Something about this action changed after approval." };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Idempotency                                                          */
/* ------------------------------------------------------------------ */

/** Idempotency keys are scoped to tenant, workflow step and artifact/action version. */
export function idempotencyKey(parts: { orgId: string; runId: string; stepIndex: number; subject?: string; version?: number }): string {
  return [parts.orgId, parts.runId, `s${parts.stepIndex}`, parts.subject ?? "-", `v${parts.version ?? 0}`].join(":");
}
