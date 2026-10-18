import type { Metadata } from "next";
import { DesignLibrary } from "@/components/design/DesignLibrary";

export const metadata: Metadata = { title: "Design studio" };

export default async function DesignLibraryPage({ params }: PageProps<"/studio/[organization]">) {
  const { organization } = await params;
  return <DesignLibrary slug={organization} />;
}
