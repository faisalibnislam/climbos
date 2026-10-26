/**
 * Google Business Profile: list the accounts a user can manage and their
 * locations so the owner can pick the one for this business. Read-only.
 * Scope: business.manage. Google grants API quota only after an access request.
 */

import { asArray, asString, collectPages, isRecord, readFailure, requestJson } from "./http";
import { GBP_ACCOUNT_BASE, GBP_INFO_BASE } from "./registry";
import type { AdapterOptions, PaginationResult, ReadResult } from "./types";

export const GOOGLE_BUSINESS_PROFILE_SCOPE = "https://www.googleapis.com/auth/business.manage";

export interface GbpAccount {
  /** "accounts/{id}" */
  name: string;
  accountName: string;
  type?: string;
}

export interface GbpLocation {
  /** "locations/{id}" */
  name: string;
  title: string;
  /** Owning account, "accounts/{id}". */
  account: string;
  address?: string;
}

function auth(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listAccounts(input: AdapterOptions & { accessToken: string; maxPages?: number }): Promise<ReadResult<PaginationResult<GbpAccount>>> {
  return collectPages<GbpAccount>(
    async (cursor) => {
      const url = new URL(`${GBP_ACCOUNT_BASE}/accounts`);
      url.searchParams.set("pageSize", "20");
      if (cursor) url.searchParams.set("pageToken", cursor);
      const out = await requestJson({ url: url.toString(), headers: auth(input.accessToken), fetchImpl: input.fetchImpl, timeoutMs: input.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const data = isRecord(out.data) ? out.data : {};
      const items: GbpAccount[] = [];
      for (const raw of asArray(data.accounts)) {
        if (!isRecord(raw)) continue;
        const name = asString(raw.name);
        if (!name || !/^accounts\/\d+$/.test(name)) continue;
        items.push({ name, accountName: asString(raw.accountName) ?? name, type: asString(raw.type) });
      }
      return { ok: true, data: { items, nextCursor: asString(data.nextPageToken) || undefined } };
    },
    { maxPages: input.maxPages ?? 3 },
  );
}

function formatAddress(raw: unknown): string | undefined {
  if (!isRecord(raw)) return undefined;
  const lines = asArray(raw.addressLines).filter((l): l is string => typeof l === "string");
  const parts = [...lines, asString(raw.locality), asString(raw.postalCode)].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(", ").slice(0, 200) : undefined;
}

export async function listLocations(input: AdapterOptions & { accessToken: string; account: string; maxPages?: number }): Promise<ReadResult<PaginationResult<GbpLocation>>> {
  if (!/^accounts\/\d+$/.test(input.account)) return { ok: false, providerMessage: "Invalid Business Profile account", retryable: false };
  return collectPages<GbpLocation>(
    async (cursor) => {
      const url = new URL(`${GBP_INFO_BASE}/${input.account}/locations`);
      url.searchParams.set("readMask", "name,title,storefrontAddress");
      url.searchParams.set("pageSize", "100");
      if (cursor) url.searchParams.set("pageToken", cursor);
      const out = await requestJson({ url: url.toString(), headers: auth(input.accessToken), fetchImpl: input.fetchImpl, timeoutMs: input.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const data = isRecord(out.data) ? out.data : {};
      const items: GbpLocation[] = [];
      for (const raw of asArray(data.locations)) {
        if (!isRecord(raw)) continue;
        const name = asString(raw.name);
        if (!name || !/^locations\/\d+$/.test(name)) continue;
        const loc: GbpLocation = { name, title: asString(raw.title) ?? name, account: input.account };
        const address = formatAddress(raw.storefrontAddress);
        if (address) loc.address = address;
        items.push(loc);
      }
      return { ok: true, data: { items, nextCursor: asString(data.nextPageToken) || undefined } };
    },
    { maxPages: input.maxPages ?? 3 },
  );
}

/** Every location across the user's accounts (bounded), for the location picker. */
export async function listAllLocations(input: AdapterOptions & { accessToken: string; maxAccounts?: number }): Promise<ReadResult<{ items: GbpLocation[]; truncated: boolean }>> {
  const accounts = await listAccounts({ ...input, maxPages: 2 });
  if (!accounts.ok) return accounts;
  const max = input.maxAccounts ?? 10;
  const items: GbpLocation[] = [];
  let truncated = accounts.data.truncated || accounts.data.items.length > max;
  for (const account of accounts.data.items.slice(0, max)) {
    const locs = await listLocations({ ...input, account: account.name, maxPages: 2 });
    if (!locs.ok) return locs;
    items.push(...locs.data.items);
    truncated ||= locs.data.truncated;
  }
  return { ok: true, data: { items, truncated } };
}
