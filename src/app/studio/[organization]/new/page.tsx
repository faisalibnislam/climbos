import type { Metadata } from "next";
import { NewDesignStudio } from "@/components/design/NewDesignStudio";

export const metadata: Metadata = { title: "Design studio" };

export default async function NewDesignPage({ params }: PageProps<"/studio/[organization]/new">) {
  const { organization } = await params;
  return <NewDesignStudio slug={organization} />;
}
