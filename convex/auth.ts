import Google from "@auth/core/providers/google";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { signInCodeEmail } from "./lib/emailTemplates";

/** 8-digit numeric sign-in code from a CSPRNG (rejection sampling, no modulo bias). */
function generateCode(): string {
  const digits: string[] = [];
  const buf = new Uint8Array(1);
  while (digits.length < 8) {
    crypto.getRandomValues(buf);
    if (buf[0] < 250) digits.push(String(buf[0] % 10));
  }
  return digits.join("");
}

const ResendOTP = Email({
  id: "resend-otp",
  maxAge: 60 * 15,
  async generateVerificationToken() {
    return generateCode();
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      throw new Error("Email sign-in is not configured yet (AUTH_RESEND_KEY is missing).");
    }
    const { subject, html, text } = signInCodeEmail(token);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "ClimbOS <hello@climbos.app>",
        to: [email],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Could not send the sign-in email (status ${res.status}). Please try again.`);
    }
  },
});

/**
 * Development-only password sign-in for local end-to-end testing without an
 * email provider. Double-gated: the flag must be set AND the deployment's
 * SITE_URL must be localhost, so it can never be enabled on production.
 */
export const devLoginEnabled =
  process.env.CLIMBOS_ENABLE_DEV_LOGIN === "true" && (process.env.SITE_URL ?? "").startsWith("http://localhost");

const providers = [
  ResendOTP,
  Anonymous,
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
  ...(devLoginEnabled ? [Password({ id: "dev-password" })] : []),
];

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
});
