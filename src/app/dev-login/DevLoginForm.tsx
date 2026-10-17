"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Button, Callout, Field, Input } from "@/components/ui";

export function DevLoginForm() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("tester@example.com");
  const [password, setPassword] = useState("climbos-dev-password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await signIn("dev-password", { email, password, flow: "signIn" }).catch(() =>
            signIn("dev-password", { email, password, flow: "signUp" }),
          );
          window.location.assign(new URLSearchParams(window.location.search).get("next") ?? "/app");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Sign-in failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Callout tone="danger">{error}</Callout>}
      <Field label="Email">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" loading={busy}>Sign in</Button>
    </form>
  );
}
