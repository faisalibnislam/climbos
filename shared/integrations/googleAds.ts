/**
 * Google Ads API (REST, v26): GAQL reads, paused Search campaign creation and
 * approved status changes, each verified by a read-back.
 *
 * Headers: Authorization (OAuth adwords scope), developer-token, and
 * login-customer-id when operating through a manager (MCC) account.
 */

import { currencyExponent, microsToMinor, minorToMicros } from "./currency";
import { asArray, asNumber, asString, collectPages, isRecord, readFailure, requestJson, writeFailure } from "./http";
import { GOOGLE_ADS_BASE } from "./registry";
import { approvalError, type AdapterOptions, type ApprovedAction, type PaginationResult, type ReadResult, type ReconcileResult, type WriteResult } from "./types";

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export interface GoogleAdsAuth extends AdapterOptions {
  accessToken: string;
  developerToken: string;
  /** Manager account id when accessing a client through an MCC (digits or 123-456-7890). */
  loginCustomerId?: string;
  /** The advertiser account being read/changed. */
  customerId: string;
}

export function normalizeCustomerId(id: string): string {
  const digits = id.replace(/-/g, "").trim();
  if (!/^\d{10}$/.test(digits)) throw new Error(`Invalid Google Ads customer id: ${id}`);
  return digits;
}

export function googleAdsHeaders(auth: Pick<GoogleAdsAuth, "accessToken" | "developerToken" | "loginCustomerId">): Record<string, string> {
  if (!auth.developerToken) throw new Error("Google Ads developer token is required");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
    "developer-token": auth.developerToken,
  };
  if (auth.loginCustomerId) headers["login-customer-id"] = normalizeCustomerId(auth.loginCustomerId);
  return headers;
}

/** Escape a string literal for GAQL single-quoted strings. */
export function gaqlString(value: string): string {
  if (/[\u0000-\u001f]/.test(value)) throw new Error("GAQL string contains control characters");
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function searchGaql(
  auth: GoogleAdsAuth & { query: string; maxPages?: number },
): Promise<ReadResult<PaginationResult<Record<string, unknown>>>> {
  const cid = normalizeCustomerId(auth.customerId);
  const url = `${GOOGLE_ADS_BASE}/customers/${cid}/googleAds:search`;
  return collectPages<Record<string, unknown>>(
    async (cursor) => {
      const body: Record<string, unknown> = { query: auth.query };
      if (cursor) body.pageToken = cursor;
      const out = await requestJson({ url, method: "POST", headers: googleAdsHeaders(auth), body, fetchImpl: auth.fetchImpl, timeoutMs: auth.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const data = isRecord(out.data) ? out.data : {};
      const items = asArray(data.results).filter(isRecord);
      return { ok: true, data: { items, nextCursor: asString(data.nextPageToken) || undefined } };
    },
    { maxPages: auth.maxPages ?? 20 },
  );
}

/** searchStream returns every row in one response (a JSON array of batches). */
export async function searchStreamGaql(auth: GoogleAdsAuth & { query: string }): Promise<ReadResult<Record<string, unknown>[]>> {
  const cid = normalizeCustomerId(auth.customerId);
  const out = await requestJson({
    url: `${GOOGLE_ADS_BASE}/customers/${cid}/googleAds:searchStream`,
    method: "POST",
    headers: googleAdsHeaders(auth),
    body: { query: auth.query },
    fetchImpl: auth.fetchImpl,
    timeoutMs: auth.timeoutMs ?? 60_000,
  });
  if (out.kind !== "ok") return readFailure(out);
  const batches = Array.isArray(out.data) ? out.data : [out.data];
  const rows: Record<string, unknown>[] = [];
  for (const b of batches) if (isRecord(b)) rows.push(...asArray(b.results).filter(isRecord));
  return { ok: true, data: rows };
}

export function buildCampaignMetricsQuery(startDate: string, endDate: string): string {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) throw new Error("Dates must be YYYY-MM-DD");
  if (startDate > endDate) throw new Error("startDate must be on or before endDate");
  return [
    "SELECT campaign.id, campaign.name, campaign.status, segments.date,",
    "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value",
    "FROM campaign",
    `WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
    "ORDER BY segments.date",
  ].join(" ");
}

export interface CampaignDailyMetrics {
  campaignId: string;
  campaignName: string;
  date: string;
  costMicros: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionsValue: number;
}

function sub(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = row[key];
  return isRecord(v) ? v : {};
}

export function parseCampaignMetricsRow(row: Record<string, unknown>): CampaignDailyMetrics {
  const c = sub(row, "campaign");
  const s = sub(row, "segments");
  const m = sub(row, "metrics");
  return {
    campaignId: asString(c.id) ?? "",
    campaignName: asString(c.name) ?? "",
    date: asString(s.date) ?? "",
    // int64 fields arrive as JSON strings
    costMicros: asNumber(m.costMicros),
    clicks: asNumber(m.clicks),
    impressions: asNumber(m.impressions),
    conversions: asNumber(m.conversions),
    conversionsValue: asNumber(m.conversionsValue),
  };
}

export async function getCampaignMetrics(
  auth: GoogleAdsAuth & { startDate: string; endDate: string; maxPages?: number },
): Promise<ReadResult<PaginationResult<CampaignDailyMetrics>>> {
  const res = await searchGaql({ ...auth, query: buildCampaignMetricsQuery(auth.startDate, auth.endDate) });
  if (!res.ok) return res;
  return { ok: true, data: { ...res.data, items: res.data.items.map(parseCampaignMetricsRow) } };
}

export interface CustomerSettings {
  currencyCode: string;
  timeZone: string;
  testAccount: boolean;
}

export async function getCustomerSettings(auth: GoogleAdsAuth): Promise<ReadResult<CustomerSettings>> {
  const res = await searchGaql({ ...auth, query: "SELECT customer.currency_code, customer.time_zone, customer.test_account FROM customer", maxPages: 1 });
  if (!res.ok) return res;
  const first = res.data.items[0];
  if (!first) return { ok: false, providerMessage: "Customer not found", retryable: false };
  const c = sub(first, "customer");
  return { ok: true, data: { currencyCode: asString(c.currencyCode) ?? "", timeZone: asString(c.timeZone) ?? "", testAccount: c.testAccount === true } };
}

export interface CampaignState {
  resourceName: string;
  campaignId: string;
  name: string;
  status: string;
}

function parseCampaignState(row: Record<string, unknown>): CampaignState {
  const c = sub(row, "campaign");
  return {
    resourceName: asString(c.resourceName) ?? "",
    campaignId: asString(c.id) ?? "",
    name: asString(c.name) ?? "",
    status: asString(c.status) ?? "",
  };
}

export async function getCampaignState(auth: GoogleAdsAuth & { campaignId: string }): Promise<ReadResult<CampaignState | null>> {
  if (!/^\d+$/.test(auth.campaignId)) return { ok: false, providerMessage: "Invalid campaign id", retryable: false };
  const res = await searchGaql({
    ...auth,
    query: `SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.id = ${auth.campaignId}`,
    maxPages: 1,
  });
  if (!res.ok) return res;
  const first = res.data.items[0];
  return { ok: true, data: first ? parseCampaignState(first) : null };
}

/** Reconcile an uncertain create: campaign names are unique per account. */
export async function reconcileCampaignByName(auth: GoogleAdsAuth & { name: string }): Promise<ReconcileResult<CampaignState>> {
  const res = await searchGaql({
    ...auth,
    query: `SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.name = ${gaqlString(auth.name)} AND campaign.status != 'REMOVED'`,
    maxPages: 1,
  });
  if (!res.ok) return { outcome: "unknown", providerMessage: res.providerMessage };
  const first = res.data.items[0];
  if (!first) return { outcome: "not_found" };
  const state = parseCampaignState(first);
  return { outcome: "found", externalId: state.campaignId, data: state };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface SearchCampaignDraft {
  /** Unique within the account; also the reconcile key. */
  name: string;
  /** ISO 4217; must equal the account currency. */
  currency: string;
  dailyBudgetMinor: number;
  /** Hard guardrail supplied by the business (required). */
  maxDailyBudgetMinor: number;
  /** YYYY-MM-DD in the account's time zone. */
  startDate: string;
  endDate: string;
  /** Required self-declaration (Google Ads EU political ads policy). */
  containsEuPoliticalAdvertising: boolean;
  targetGoogleSearch?: boolean;
  targetSearchNetwork?: boolean;
}

export interface DraftValidationContext {
  accountCurrency: string;
  /** Today's date in the account time zone, YYYY-MM-DD. */
  today: string;
  maxDurationDays?: number;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function validateSearchCampaignDraft(draft: SearchCampaignDraft, ctx: DraftValidationContext): string[] {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (!name) errors.push("Campaign name is required.");
  if (name.length > 255) errors.push("Campaign name must be at most 255 characters.");
  if (/[\u0000-\u001f]/.test(name)) errors.push("Campaign name contains control characters.");
  let exp: number | undefined;
  try {
    exp = currencyExponent(draft.currency);
  } catch {
    errors.push(`Currency "${draft.currency}" is not a valid ISO 4217 code.`);
  }
  if (exp !== undefined && draft.currency.toUpperCase() !== ctx.accountCurrency.toUpperCase()) {
    errors.push(`Budget currency ${draft.currency.toUpperCase()} does not match the ad account currency ${ctx.accountCurrency.toUpperCase()}.`);
  }
  if (!Number.isSafeInteger(draft.dailyBudgetMinor) || draft.dailyBudgetMinor <= 0) errors.push("Daily budget must be a positive whole number of minor units.");
  if (!Number.isSafeInteger(draft.maxDailyBudgetMinor) || draft.maxDailyBudgetMinor <= 0) errors.push("A positive maximum daily budget guardrail is required.");
  else if (draft.dailyBudgetMinor > draft.maxDailyBudgetMinor) errors.push("Daily budget is above the approved maximum.");
  if (!DATE_RE.test(draft.startDate) || Number.isNaN(Date.parse(draft.startDate))) errors.push("Start date must be YYYY-MM-DD.");
  if (!DATE_RE.test(draft.endDate) || Number.isNaN(Date.parse(draft.endDate))) errors.push("End date must be YYYY-MM-DD.");
  if (DATE_RE.test(draft.startDate) && DATE_RE.test(draft.endDate)) {
    if (draft.startDate < ctx.today) errors.push("Start date cannot be in the past.");
    if (draft.endDate < draft.startDate) errors.push("End date must be on or after the start date.");
    const maxDays = ctx.maxDurationDays ?? 90;
    if (daysBetween(draft.startDate, draft.endDate) + 1 > maxDays) errors.push(`Campaign may run at most ${maxDays} days.`);
  }
  if (typeof draft.containsEuPoliticalAdvertising !== "boolean") errors.push("EU political advertising declaration is required.");
  return errors;
}

export function buildCreatePausedSearchCampaignMutate(customerId: string, draft: SearchCampaignDraft): Record<string, unknown> {
  const cid = normalizeCustomerId(customerId);
  const budgetTemp = `customers/${cid}/campaignBudgets/-1`;
  return {
    mutateOperations: [
      {
        campaignBudgetOperation: {
          create: {
            resourceName: budgetTemp,
            name: `${draft.name.trim()} budget`,
            amountMicros: String(minorToMicros(draft.dailyBudgetMinor, draft.currency)),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      },
      {
        campaignOperation: {
          create: {
            name: draft.name.trim(),
            advertisingChannelType: "SEARCH",
            status: "PAUSED",
            campaignBudget: budgetTemp,
            manualCpc: {},
            networkSettings: {
              targetGoogleSearch: draft.targetGoogleSearch ?? true,
              targetSearchNetwork: draft.targetSearchNetwork ?? false,
              targetContentNetwork: false,
              targetPartnerSearchNetwork: false,
            },
            startDateTime: `${draft.startDate} 00:00:00`,
            endDateTime: `${draft.endDate} 23:59:59`,
            containsEuPoliticalAdvertising: draft.containsEuPoliticalAdvertising
              ? "CONTAINS_EU_POLITICAL_ADVERTISING"
              : "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          },
        },
      },
    ],
    partialFailure: false,
  };
}

function campaignIdFromResourceName(rn: string): string | undefined {
  return /\/campaigns\/(\d+)$/.exec(rn)?.[1];
}

/**
 * Create a campaign budget + Search campaign (status PAUSED) atomically, then
 * read the campaign back. "verified" only if the read-back shows PAUSED.
 * On "uncertain", call reconcileCampaignByName before any retry.
 */
export async function createPausedSearchCampaign(
  auth: GoogleAdsAuth & { draft: SearchCampaignDraft; today: string; maxDurationDays?: number },
): Promise<WriteResult<CampaignState>> {
  const settings = await getCustomerSettings(auth);
  if (!settings.ok) return { status: "failed", retryable: settings.retryable, providerMessage: `Could not read account settings: ${settings.providerMessage}` };
  const errors = validateSearchCampaignDraft(auth.draft, { accountCurrency: settings.data.currencyCode, today: auth.today, maxDurationDays: auth.maxDurationDays });
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };

  const cid = normalizeCustomerId(auth.customerId);
  const out = await requestJson({
    url: `${GOOGLE_ADS_BASE}/customers/${cid}/googleAds:mutate`,
    method: "POST",
    headers: googleAdsHeaders(auth),
    body: buildCreatePausedSearchCampaignMutate(cid, auth.draft),
    fetchImpl: auth.fetchImpl,
    timeoutMs: auth.timeoutMs,
  });
  if (out.kind !== "ok") return writeFailure(out);

  const responses = isRecord(out.data) ? asArray(out.data.mutateOperationResponses) : [];
  let campaignRn: string | undefined;
  for (const r of responses) {
    if (isRecord(r) && isRecord(r.campaignResult)) campaignRn = asString(r.campaignResult.resourceName);
  }
  const campaignId = campaignRn ? campaignIdFromResourceName(campaignRn) : undefined;
  if (!campaignId) {
    return { status: "uncertain", retryable: false, providerMessage: "Mutate succeeded without a campaign resource name; reconcile by name." };
  }
  return verifyCampaignStatus(auth, campaignId, "PAUSED");
}

async function verifyCampaignStatus(auth: GoogleAdsAuth, campaignId: string, expected: "ENABLED" | "PAUSED"): Promise<WriteResult<CampaignState>> {
  const read = await getCampaignState({ ...auth, campaignId });
  if (!read.ok) {
    return { status: "uncertain", externalId: campaignId, retryable: false, providerMessage: `Change sent but read-back failed: ${read.providerMessage}` };
  }
  if (!read.data) {
    return { status: "uncertain", externalId: campaignId, retryable: false, providerMessage: "Change sent but the campaign was not found on read-back." };
  }
  if (read.data.status !== expected) {
    return { status: "uncertain", externalId: campaignId, retryable: false, providerMessage: `Read-back shows status ${read.data.status}, expected ${expected}.`, data: read.data };
  }
  return { status: "verified", externalId: campaignId, retryable: false, data: read.data };
}

export const SET_CAMPAIGN_STATUS_ACTION = "google_ads.set_campaign_status";

/** Set a campaign to ENABLED or PAUSED. Requires an approval for exactly this campaign + status. */
export async function setCampaignStatus(
  auth: GoogleAdsAuth & { campaignId: string; status: "ENABLED" | "PAUSED"; approval: ApprovedAction | undefined; now?: number },
): Promise<WriteResult<CampaignState>> {
  if (auth.status !== "ENABLED" && auth.status !== "PAUSED") return { status: "failed", retryable: false, providerMessage: "Status must be ENABLED or PAUSED." };
  if (!/^\d+$/.test(auth.campaignId)) return { status: "failed", retryable: false, providerMessage: "Invalid campaign id." };
  const refusal = approvalError(auth.approval, { kind: SET_CAMPAIGN_STATUS_ACTION, targetId: auth.campaignId, value: auth.status }, auth.now);
  if (refusal) return { status: "failed", retryable: false, providerMessage: refusal };

  const cid = normalizeCustomerId(auth.customerId);
  const out = await requestJson({
    url: `${GOOGLE_ADS_BASE}/customers/${cid}/campaigns:mutate`,
    method: "POST",
    headers: googleAdsHeaders(auth),
    body: {
      operations: [{ update: { resourceName: `customers/${cid}/campaigns/${auth.campaignId}`, status: auth.status }, updateMask: "status" }],
    },
    fetchImpl: auth.fetchImpl,
    timeoutMs: auth.timeoutMs,
  });
  if (out.kind !== "ok") return writeFailure(out);
  return verifyCampaignStatus(auth, auth.campaignId, auth.status);
}

/** Convenience for reports: micros → minor units of the account currency. */
export function costMinor(metrics: CampaignDailyMetrics, currency: string): number {
  return microsToMinor(metrics.costMicros, currency);
}
