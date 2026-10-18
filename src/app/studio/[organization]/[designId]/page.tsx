import type { Metadata } from "next";
import type { Id } from "@convex/_generated/dataModel";
import { DesignStudioEditor } from "@/components/design/DesignStudioEditor";

export const metadata: Metadata = { title: "Design studio" };

export default async function DesignPage({ params, searchParams }: PageProps<"/studio/[organization]/[designId]">) {
  const { organization, designId } = await params;
  const { post } = await searchParams;
  return <DesignStudioEditor slug={organization} designId={designId as Id<"designs">} postId={typeof post === "string" ? post : undefined} />;
}
