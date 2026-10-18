import { AppShell } from "@/components/app/AppShell";

/** The design studio keeps the app frame: top bar plus a collapsed sidebar rail. */
export default async function StudioLayout({ children, params }: LayoutProps<"/studio/[organization]">) {
  const { organization } = await params;
  return (
    <AppShell slug={organization} workspace>
      {children}
    </AppShell>
  );
}
