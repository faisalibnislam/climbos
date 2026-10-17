"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { SocialIcon } from "@/components/ui/social-icon";
import { safeNextPath } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Step = "email" | "code";

/** Email one-time-code sign-in (8 digits, 15-minute expiry) with optional Google. */
export function SignInForm() {
  const { signIn } = useAuthActions();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/app");
  // Decided by the backend at runtime: a method appears once its keys are configured.
  const options = useQuery(api.publicConfig.signInOptions, {});
  const emailOff = options?.email === false;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "send" | "verify" | "google">(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const value = email.trim();
    setFormError(null);
    setNotice(null);
    if (!EMAIL_RE.test(value)) {
      setFieldError("Enter a valid email address, like you@yourbusiness.com.");
      emailRef.current?.focus();
      return;
    }
    setFieldError(null);
    setBusy("send");
    try {
      await signIn("resend-otp", { email: value });
      setCode("");
      if (step === "code") setNotice(`We sent a new code to ${value}.`);
      setStep("code");
    } catch {
      setFormError("We couldn't send the email. Check the address or try again in a minute.");
    } finally {
      setBusy(null);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 8) {
      setFieldError("The code has 8 digits. Check the email we sent and try again.");
      codeRef.current?.focus();
      return;
    }
    setFieldError(null);
    setBusy("verify");
    try {
      await signIn("resend-otp", { email: email.trim(), code: digits });
      // Full navigation so every query re-subscribes under the new identity
      // (e.g. switching from an anonymous demo session to a real account).
      window.location.assign(next);
    } catch {
      setFormError("That code didn't work. It may be mistyped or expired — check it, or send a new code.");
      setBusy(null);
    }
  }

  async function google() {
    setFormError(null);
    setBusy("google");
    try {
      const result = await signIn("google", { redirectTo: next });
      if (result.redirect) window.location.assign(result.redirect.toString());
    } catch {
      setFormError("Google sign-in isn't available right now. Use your email instead.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {formError ? (
        <Callout tone="danger" live="alert">
          {formError}
        </Callout>
      ) : null}
      {notice ? (
        <Callout tone="success" live="status">
          {notice}
        </Callout>
      ) : null}

      {emailOff && step === "email" ? (
        <Callout tone="info" title="Email sign-in is almost ready">
          Sign-in codes by email aren&apos;t switched on yet.{options?.google ? " You can continue with Google below," : " Meanwhile,"} you can look around in the demo.
        </Callout>
      ) : null}

      {step === "email" ? (
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-4">
          <Field label="Email address" hint="We'll email you an 8-digit sign-in code. No password needed." error={fieldError ?? undefined}>
            <Input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@yourbusiness.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" loading={busy === "send"} loadingText="Sending…" disabled={emailOff || (busy !== null && busy !== "send")}>
            <Mail aria-hidden="true" />
            Email me a code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            We sent a code to <strong className="break-all font-semibold text-ink">{email.trim()}</strong>. It expires in 15 minutes.
          </p>
          <Field label="Sign-in code" hint="8 digits. Spaces are fine." error={fieldError ?? undefined}>
            <Input
              ref={codeRef}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="1234 5678"
              maxLength={20}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ""))}
              className="h-10 font-mono text-base tracking-widest"
            />
          </Field>
          <Button type="submit" size="lg" loading={busy === "verify"} loadingText="Checking…" disabled={busy !== null && busy !== "verify"}>
            Sign in
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("email");
                setFieldError(null);
                setFormError(null);
                setNotice(null);
                setTimeout(() => emailRef.current?.focus(), 0);
              }}
            >
              <ArrowLeft aria-hidden="true" />
              Use a different email
            </Button>
            <Button variant="ghost" size="sm" loading={busy === "send"} onClick={() => void sendCode()}>
              Send a new code
            </Button>
          </div>
        </form>
      )}

      {options?.google && step === "email" ? (
        <>
          <div className="flex items-center gap-3 text-xs text-ink-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" size="lg" onClick={google} loading={busy === "google"} disabled={busy !== null && busy !== "google"}>
            <SocialIcon network="google" size="lg" />
            Continue with Google
          </Button>
        </>
      ) : null}

      <p className="text-center text-sm text-ink-2">
        Just looking?{" "}
        <Link href="/demo" className="font-medium text-brand-800 underline underline-offset-4">
          Try the demo
        </Link>
      </p>
    </div>
  );
}
