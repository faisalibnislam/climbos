import { redirect } from "next/navigation";

export default async function WorkspaceIndex({ params }: PageProps<"/app/[organization]">) {
  const { organization } = await params;
  redirect(`/app/${organization}/today`);
}
