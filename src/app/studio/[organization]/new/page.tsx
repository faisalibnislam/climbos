import type { Metadata } from "next";
import { NewDesignStudio } from "@/components/design/NewDesignStudio";

export const metadata: Metadata = { title: "New design" };

export default async function NewDesignPage({ params, searchParams }: PageProps<"/studio/[organization]/new">) {
  const { organization } = await params;
  const { post } = await searchParams;
  return <NewDesignStudio slug={organization} postId={typeof post === "string" ? post : undefined} />;
}
