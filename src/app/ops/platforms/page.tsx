"use client";

import { AdminFrame } from "@/components/app/admin/AdminFrame";
import { AdminPlatformSetup } from "@/components/app/admin/AdminPlatformSetup";

/** Step-by-step developer-app setup per platform, with live configured/missing status (names only). */
export default function OpsPlatformsPage() {
  return <AdminFrame>{() => <AdminPlatformSetup />}</AdminFrame>;
}
