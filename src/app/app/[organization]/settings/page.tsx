import { redirect } from "next/navigation";

export default async function SettingsIndex({ params }: { params: Promise<{ organization: string }> }) {
  const { organization } = await params;
  redirect(`/app/${organization}/settings/team`);
}
