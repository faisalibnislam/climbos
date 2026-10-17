"use client";

import { useParams } from "next/navigation";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";
import { BillingSettings } from "@/components/app/settings/BillingSettings";

export default function BillingSettingsPage() {
  const { organization } = useParams<{ organization: string }>();
  return (
    <QueryBoundary>
      <BillingSettings slug={organization} />
    </QueryBoundary>
  );
}
