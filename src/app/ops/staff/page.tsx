"use client";

import { AdminFrame } from "@/components/app/admin/AdminFrame";
import { AdminStaff } from "@/components/app/admin/AdminStaff";

export default function OpsStaffPage() {
  return <AdminFrame>{(me) => <AdminStaff me={me} />}</AdminFrame>;
}
