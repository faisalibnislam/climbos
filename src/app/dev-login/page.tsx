import { notFound } from "next/navigation";
import { DevLoginForm } from "./DevLoginForm";

/** Local testing only. Returns 404 unless NEXT_PUBLIC_ENABLE_DEV_LOGIN=true (never set on Vercel). */
export default function DevLoginPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "true") notFound();
  return (
    <main id="main" className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl">Developer sign-in</h1>
      <p className="mt-2 text-sm text-ink-2">Local testing only. Disabled in production.</p>
      <DevLoginForm />
    </main>
  );
}
