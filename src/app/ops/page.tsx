"use client";

import { AdminDashboard } from "@/components/app/admin/AdminDashboard";
import { AdminFrame } from "@/components/app/admin/AdminFrame";

/** Admin panel home: the business dashboard. Staff only; every query re-checks on the server. */
export default function OpsPage() {
  return <AdminFrame>{() => <AdminDashboard />}</AdminFrame>;
}
