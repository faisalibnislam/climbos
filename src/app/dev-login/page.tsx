import { notFound } from "next/navigation";
import { DevLoginForm } from "./DevLoginForm";
import { localDevLoginEnabled } from "../../../shared/policy/localDevelopment";

/** Local testing only. Returns 404 unless NEXT_PUBLIC_ENABLE_DEV_LOGIN=true (never set on Vercel). */
export default function DevLoginPage() {
  if (!localDevLoginEnabled(process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN, process.env.NEXT_PUBLIC_SITE_URL)) notFound();
  return (
    <main id="main" className="mx-auto max-w-sm px-4 py-16">
      <h1 className="heading-page">Developer sign-in</h1>
      <p className="mt-1.5 text-sm text-ink-2">Local testing only. Disabled in production.</p>
      <DevLoginForm />
    </main>
  );
}
