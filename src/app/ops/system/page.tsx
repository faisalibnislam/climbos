"use client";

import { AdminFrame } from "@/components/app/admin/AdminFrame";
import { OpsConsole } from "@/components/app/ops/OpsConsole";
import { QueryBoundary } from "@/components/app/results/QueryBoundary";

/** Fleet controls, provider health, reconciliation and audit (owners and admins). */
export default function OpsSystemPage() {
  return (
    <AdminFrame>
      {() => (
        <QueryBoundary>
          <OpsConsole />
        </QueryBoundary>
      )}
    </AdminFrame>
  );
}
