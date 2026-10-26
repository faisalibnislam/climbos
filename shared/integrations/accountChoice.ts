/**
 * Account choosers: turn a provider's live list (Facebook Pages, LinkedIn
 * Pages, Analytics properties, Business Profile locations) into options the
 * owner picks from. Options never carry tokens; the server re-reads the live
 * list when the owner chooses, so a forged id can't bind someone else's Page.
 */

import type { ManagedPage } from "./facebookPages";
import type { Ga4Property } from "./ga4";
import type { GbpLocation } from "./googleBusinessProfile";
import type { LinkedInMember, LinkedInOrganization } from "./linkedin";

export interface AccountOption {
  /** What gets stored as the connection's externalAccountId. */
  id: string;
  label: string;
  detail?: string;
  accountType: string;
  /** False when this account can be chosen but not published to (shown with `warning`). */
  canPublish: boolean;
  warning?: string;
}

export function facebookPageOptions(pages: readonly ManagedPage[]): AccountOption[] {
  return pages.map((p) => ({
    id: p.id,
    label: p.name,
    detail: `Page ID ${p.id}`,
    accountType: "facebook_page",
    canPublish: p.canPublish && Boolean(p.pageAccessToken),
    ...(p.canPublish && p.pageAccessToken ? {} : { warning: "Your role on this Page doesn't allow creating posts. Ask a Page admin for content access." }),
  }));
}

/** Personal profile (member sign-in) or the Pages the member administers (LinkedIn Pages app sign-in). */
export function linkedInOptions(member: LinkedInMember | null, organizations: readonly LinkedInOrganization[]): AccountOption[] {
  return [
    ...(member ? [{ id: member.personUrn, label: member.name, detail: "Your personal profile", accountType: "linkedin_member", canPublish: true }] : []),
    ...organizations.map((o) => ({
      id: o.urn,
      label: o.name,
      detail: o.vanityName ? `LinkedIn Page · linkedin.com/company/${o.vanityName}` : "LinkedIn Page",
      accountType: "linkedin_organization",
      canPublish: true,
    })),
  ];
}

export function ga4PropertyOptions(properties: readonly Ga4Property[]): AccountOption[] {
  return properties.map((p) => ({
    id: p.property,
    label: p.displayName,
    detail: [p.accountDisplayName, p.property.replace("properties/", "Property ")].filter(Boolean).join(" · "),
    accountType: "ga4_property",
    canPublish: true,
  }));
}

export function businessProfileOptions(locations: readonly GbpLocation[]): AccountOption[] {
  return locations.map((l) => ({
    id: l.name,
    label: l.title,
    detail: l.address ?? l.name,
    accountType: "business_profile_location",
    canPublish: true,
  }));
}

/** The one option to pick automatically: only when there is exactly one and it is usable. */
export function soleChoice(options: readonly AccountOption[]): AccountOption | undefined {
  return options.length === 1 && options[0]!.canPublish ? options[0] : undefined;
}

/** Label shown while the owner still has to choose. */
export function choicePendingLabel(count: number, noun: string, plural: string): string {
  if (count === 0) return `No ${plural} found for this sign-in`;
  return `${count} ${count === 1 ? noun : plural} available · choose one`;
}
