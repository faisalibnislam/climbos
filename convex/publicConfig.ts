import { query } from "./_generated/server";

/**
 * Which sign-in methods this deployment can actually complete, decided at
 * runtime from server configuration (no secrets returned). Lets the sign-in
 * page show Google or email only once its keys exist, without a rebuild.
 */
export const signInOptions = query({
  args: {},
  handler: async () => ({
    email: Boolean(process.env.AUTH_RESEND_KEY),
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  }),
});
