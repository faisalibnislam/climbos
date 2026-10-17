/**
 * Meta Marketing API (v26.0): insights reads, paused campaign creation and
 * approved status changes, each verified by a read-back.
 * Scopes: ads_read (reads), ads_management (writes).
 */

import { asArray, asNumber, asString, isRecord } from "./http";
import { graphCollect, graphGet, graphPost, metaReadFailure, metaWriteFailure, type GraphCall } from "./metaGraph";
import { GRAPH_BASE } from "./registry";
import { approvalError, type ApprovedAction, type PaginationResult, type ReadResult, type ReconcileResult, type WriteResult } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Objectives ClimbOS will create. App promotion is excluded on purpose. */
export const ALLOWED_OBJECTIVES = ["OUTCOME_TRAFFIC", "OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT"] as const;
export type MetaObjective = (typeof ALLOWED_OBJECTIVES)[number];

export const SPECIAL_AD_CATEGORIES = [
  "CREDIT",
  "EMPLOYMENT",
  "HOUSING",
  "ISSUES_ELECTIONS_POLITICS",
  "ONLINE_GAMBLING_AND_GAMING",
  "FINANCIAL_PRODUCTS_SERVICES",
] as const;
export type SpecialAdCategory = (typeof SPECIAL_AD_CATEGORIES)[number];

export function normalizeAdAccountId(id: string): string {
  const raw = id.trim().replace(/^act_/, "");
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid ad account id: ${id}`);
  return `act_${raw}`;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface MetaInsightRow {
  date: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  currency?: string;
  actions: Array<{ actionType: string; value: number }>;
}

export function buildInsightsUrl(adAccountId: string, since: string, until: string, level: "account" | "campaign" = "campaign"): URL {
  if (!DATE_RE.test(since) || !DATE_RE.test(until)) throw new Error("Dates must be YYYY-MM-DD");
  if (since > until) throw new Error("since must be on or before until");
  const url = new URL(`${GRAPH_BASE}/${normalizeAdAccountId(adAccountId)}/insights`);
  url.searchParams.set("fields", "campaign_id,campaign_name,spend,impressions,clicks,actions,account_currency,date_start");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("level", level);
  url.searchParams.set("limit", "500");
  return url;
}

export function parseInsightRow(raw: Record<string, unknown>): MetaInsightRow {
  return {
    date: asString(raw.date_start) ?? "",
    campaignId: asString(raw.campaign_id) ?? "",
    campaignName: asString(raw.campaign_name) ?? "",
    spend: asNumber(raw.spend),
    impressions: asNumber(raw.impressions),
    clicks: asNumber(raw.clicks),
    currency: asString(raw.account_currency),
    actions: asArray(raw.actions)
      .filter(isRecord)
      .map((a) => ({ actionType: asString(a.action_type) ?? "", value: asNumber(a.value) })),
  };
}

export async function getInsights(
  call: GraphCall & { adAccountId: string; since: string; until: string; level?: "account" | "campaign"; maxPages?: number },
): Promise<ReadResult<PaginationResult<MetaInsightRow>>> {
  return graphCollect(call, buildInsightsUrl(call.adAccountId, call.since, call.until, call.level), parseInsightRow, call.maxPages ?? 20);
}

// ---------------------------------------------------------------------------
// Campaign state
// ---------------------------------------------------------------------------

export interface MetaCampaignState {
  id: string;
  name: string;
  status: string;
  effectiveStatus?: string;
  objective?: string;
  spendCap?: number;
}

function parseCampaign(raw: Record<string, unknown>): MetaCampaignState {
  const s: MetaCampaignState = { id: asString(raw.id) ?? "", name: asString(raw.name) ?? "", status: asString(raw.status) ?? "" };
  const eff = asString(raw.effective_status);
  if (eff) s.effectiveStatus = eff;
  const obj = asString(raw.objective);
  if (obj) s.objective = obj;
  if (raw.spend_cap !== undefined) s.spendCap = asNumber(raw.spend_cap);
  return s;
}

export async function getCampaign(call: GraphCall & { campaignId: string }): Promise<ReadResult<MetaCampaignState>> {
  if (!/^\d+$/.test(call.campaignId)) return { ok: false, providerMessage: "Invalid campaign id", retryable: false };
  const url = new URL(`${GRAPH_BASE}/${call.campaignId}`);
  url.searchParams.set("fields", "id,name,status,effective_status,objective,spend_cap");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  return { ok: true, data: parseCampaign(isRecord(out.data) ? out.data : {}) };
}

export async function reconcileCampaignByName(call: GraphCall & { adAccountId: string; name: string }): Promise<ReconcileResult<MetaCampaignState>> {
  const url = new URL(`${GRAPH_BASE}/${normalizeAdAccountId(call.adAccountId)}/campaigns`);
  url.searchParams.set("fields", "id,name,status,effective_status,objective,spend_cap");
  url.searchParams.set("filtering", JSON.stringify([{ field: "name", operator: "EQUAL", value: call.name }]));
  url.searchParams.set("limit", "50");
  const res = await graphCollect(call, url, parseCampaign, 3);
  if (!res.ok) return { outcome: "unknown", providerMessage: res.providerMessage };
  const match = res.data.items.find((c) => c.name === call.name);
  return match ? { outcome: "found", externalId: match.id, data: match } : { outcome: "not_found" };
}

async function verifyStatus(call: GraphCall, campaignId: string, expected: "ACTIVE" | "PAUSED"): Promise<WriteResult<MetaCampaignState>> {
  const read = await getCampaign({ ...call, campaignId });
  if (!read.ok) return { status: "uncertain", externalId: campaignId, retryable: false, providerMessage: `Change sent but read-back failed: ${read.providerMessage}` };
  if (read.data.status !== expected) {
    return { status: "uncertain", externalId: campaignId, retryable: false, providerMessage: `Read-back shows ${read.data.status}, expected ${expected}.`, data: read.data };
  }
  return { status: "verified", externalId: campaignId, retryable: false, data: read.data };
}

// ---------------------------------------------------------------------------
// Create paused campaign
// ---------------------------------------------------------------------------

export interface MetaCampaignDraft {
  /** Unique client-provided name; used for reconcile. */
  name: string;
  objective: string;
  /** Required. Pass [] explicitly when none apply. */
  specialAdCategories: readonly string[] | undefined;
  /** Optional lifetime spend cap in currency minor units. */
  spendCapMinor?: number;
  /** Required when spendCapMinor is set: guardrail approved by the business. */
  maxSpendCapMinor?: number;
  /** Meta's documented minimum is ≈ $100 equivalent; caller supplies the local minimum in minor units. */
  minSpendCapMinor?: number;
}

export function validateMetaCampaignDraft(d: MetaCampaignDraft): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push("Campaign name is required.");
  if (d.name.length > 400) errors.push("Campaign name is too long.");
  if (!(ALLOWED_OBJECTIVES as readonly string[]).includes(d.objective)) {
    errors.push(`Objective must be one of ${ALLOWED_OBJECTIVES.join(", ")}.`);
  }
  if (!Array.isArray(d.specialAdCategories)) {
    errors.push("special_ad_categories is required (use an empty list when none apply).");
  } else {
    for (const c of d.specialAdCategories) {
      if (!(SPECIAL_AD_CATEGORIES as readonly string[]).includes(c)) errors.push(`Unknown special ad category ${c}.`);
    }
  }
  if (d.spendCapMinor !== undefined) {
    if (!Number.isSafeInteger(d.spendCapMinor) || d.spendCapMinor <= 0) errors.push("Spend cap must be a positive whole number of minor units.");
    if (d.maxSpendCapMinor === undefined) errors.push("A maximum spend cap guardrail is required when setting a spend cap.");
    else if (d.spendCapMinor > d.maxSpendCapMinor) errors.push("Spend cap is above the approved maximum.");
    if (d.minSpendCapMinor !== undefined && d.spendCapMinor < d.minSpendCapMinor) errors.push("Spend cap is below Meta's minimum for this currency.");
  }
  return errors;
}

export function buildCreateCampaignParams(d: MetaCampaignDraft): Record<string, string> {
  const params: Record<string, string> = {
    name: d.name.trim(),
    objective: d.objective,
    status: "PAUSED",
    special_ad_categories: JSON.stringify(d.specialAdCategories ?? []),
    // Budgets live on ad sets (none created here), so budget sharing is off.
    is_adset_budget_sharing_enabled: "false",
  };
  if (d.spendCapMinor !== undefined) params.spend_cap = String(d.spendCapMinor);
  return params;
}

/** Create a PAUSED campaign and verify via read-back. On "uncertain", call reconcileCampaignByName first. */
export async function createPausedCampaign(call: GraphCall & { adAccountId: string; draft: MetaCampaignDraft }): Promise<WriteResult<MetaCampaignState>> {
  const errors = validateMetaCampaignDraft(call.draft);
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };
  const url = new URL(`${GRAPH_BASE}/${normalizeAdAccountId(call.adAccountId)}/campaigns`);
  const out = await graphPost(call, url, buildCreateCampaignParams(call.draft));
  if (out.kind !== "ok") return metaWriteFailure(out);
  const id = isRecord(out.data) ? asString(out.data.id) : undefined;
  if (!id) return { status: "uncertain", retryable: false, providerMessage: "Create returned no id; reconcile by name." };
  return verifyStatus(call, id, "PAUSED");
}

export const SET_META_CAMPAIGN_STATUS_ACTION = "meta_ads.set_campaign_status";

export async function setCampaignStatus(
  call: GraphCall & { campaignId: string; status: "ACTIVE" | "PAUSED"; approval: ApprovedAction | undefined; now?: number },
): Promise<WriteResult<MetaCampaignState>> {
  if (call.status !== "ACTIVE" && call.status !== "PAUSED") return { status: "failed", retryable: false, providerMessage: "Status must be ACTIVE or PAUSED." };
  if (!/^\d+$/.test(call.campaignId)) return { status: "failed", retryable: false, providerMessage: "Invalid campaign id." };
  const refusal = approvalError(call.approval, { kind: SET_META_CAMPAIGN_STATUS_ACTION, targetId: call.campaignId, value: call.status }, call.now);
  if (refusal) return { status: "failed", retryable: false, providerMessage: refusal };
  const out = await graphPost(call, new URL(`${GRAPH_BASE}/${call.campaignId}`), { status: call.status });
  if (out.kind !== "ok") return metaWriteFailure(out);
  return verifyStatus(call, call.campaignId, call.status);
}

// ---------------------------------------------------------------------------
// Spend cap usage (ad account level; spend_cap and amount_spent are minor units)
// ---------------------------------------------------------------------------

export interface SpendCapUsage {
  currency: string;
  /** 0 or absent means no cap is set. */
  spendCapMinor: number;
  amountSpentMinor: number;
  /** undefined when no cap is set. */
  usedFraction?: number;
}

export async function getAccountSpendCapUsage(call: GraphCall & { adAccountId: string }): Promise<ReadResult<SpendCapUsage>> {
  const url = new URL(`${GRAPH_BASE}/${normalizeAdAccountId(call.adAccountId)}`);
  url.searchParams.set("fields", "spend_cap,amount_spent,currency");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  const d = isRecord(out.data) ? out.data : {};
  const spendCapMinor = asNumber(d.spend_cap);
  const amountSpentMinor = asNumber(d.amount_spent);
  const usage: SpendCapUsage = { currency: (asString(d.currency) ?? "").toUpperCase(), spendCapMinor, amountSpentMinor };
  if (spendCapMinor > 0) usage.usedFraction = Math.min(1, amountSpentMinor / spendCapMinor);
  return { ok: true, data: usage };
}
