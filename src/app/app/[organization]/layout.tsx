import { AppShell } from "@/components/app/AppShell";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/app/[organization]">) {
  const { organization } = await params;
  return <AppShell slug={organization}>{children}</AppShell>;
}
