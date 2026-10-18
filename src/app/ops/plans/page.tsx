"use client";

import { AdminFrame } from "@/components/app/admin/AdminFrame";
import { AdminPlans } from "@/components/app/admin/AdminPlans";

export default function OpsPlansPage() {
  return <AdminFrame>{() => <AdminPlans />}</AdminFrame>;
}
