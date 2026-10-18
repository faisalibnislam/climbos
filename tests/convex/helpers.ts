import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";

export const modules = import.meta.glob("../../convex/**/*.ts");

export function setup() {
  process.env.CLIMBOS_ENCRYPTION_KEY = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 7)));
  process.env.CLIMBOS_ENCRYPTION_KEY_ID = "k1";
  process.env.CLIMBOS_SERVER_SECRET = "test-server-secret";
  process.env.OPS_EMAILS = "ops@example.com";
  process.env.POLAR_WEBHOOK_SECRET = "polar_test_secret";
  process.env.POLAR_PRODUCT_BASIC = "prod_basic";
  process.env.POLAR_PRODUCT_STARTER = "prod_starter";
  process.env.POLAR_PRODUCT_GROWTH = "prod_growth";
  process.env.POLAR_PRODUCT_PRO = "prod_pro";
  process.env.POLAR_PRODUCT_BUSINESS = "prod_business";
  process.env.POLAR_PRODUCT_BOOST_29 = "prod_boost";
  process.env.POLAR_PRODUCT_CREDITS_10 = "prod_c10";
  process.env.POLAR_PRODUCT_CREDITS_25 = "prod_c25";
  process.env.POLAR_PRODUCT_CREDITS_50 = "prod_c50";
  delete process.env.POLAR_ACCESS_TOKEN;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  return convexTest(schema, modules);
}

export type T = ReturnType<typeof setup>;

/** Create a user and return a client acting as them (Convex Auth subject = "userId|sessionId"). */
export async function asNewUser(t: T, email: string, opts: { anonymous?: boolean } = {}) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: opts.anonymous ? undefined : email, isAnonymous: opts.anonymous, name: email.split("@")[0] }),
  );
  return { userId: userId as Id<"users">, client: t.withIdentity({ subject: `${userId}|session-${email}`, tokenIdentifier: `test|${userId}` }) };
}
