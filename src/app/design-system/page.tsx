import { redirect } from "next/navigation";

/** The design system lives at /design-system/v2 (Signal). */
export default function DesignSystemPage() {
  redirect("/design-system/v2");
}
