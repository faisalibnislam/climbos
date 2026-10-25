/** Exact provider destination included in paid-campaign approval bindings. */
export function campaignApprovalScope(
  campaign: {
    connectionId?: string;
    destinationUrl?: string;
    audience?: string;
    dailyBudgetMinor?: number;
    currency: string;
    startDate?: string;
    endDate?: string;
    targetCostPerConversionMinor?: number;
    reviewAfterDays?: number;
  },
  externalAccountId: string | null | undefined,
) {
  return {
    connectionId: campaign.connectionId,
    externalAccountId: externalAccountId ?? undefined,
    destination: campaign.destinationUrl,
    audience: campaign.audience,
    spendLimitMinor: campaign.dailyBudgetMinor,
    currency: campaign.currency,
    windowStart: campaign.startDate ? Date.parse(`${campaign.startDate}T00:00:00Z`) : undefined,
    windowEnd: campaign.endDate ? Date.parse(`${campaign.endDate}T23:59:59Z`) : undefined,
    targetCostPerConversionMinor: campaign.targetCostPerConversionMinor,
    reviewAfterDays: campaign.reviewAfterDays,
  };
}
