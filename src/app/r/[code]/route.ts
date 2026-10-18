import { NextResponse, type NextRequest } from "next/server";

/** Referral share link: remembers the code for 30 days, then opens the home page. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = NextResponse.redirect(new URL("/", request.url));
  if (/^[a-z0-9]{6,12}$/i.test(code)) {
    res.cookies.set("climbos_ref", code.toLowerCase(), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
  }
  return res;
}
