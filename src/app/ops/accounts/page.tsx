"use client";

import { AdminAccounts } from "@/components/app/admin/AdminAccounts";
import { AdminFrame } from "@/components/app/admin/AdminFrame";

export default function OpsAccountsPage() {
  return <AdminFrame>{() => <AdminAccounts />}</AdminFrame>;
}
