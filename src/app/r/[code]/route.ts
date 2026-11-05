import { NextResponse } from "next/server";
import { REF_CODE_RE, REF_COOKIE } from "@/lib/referrals";
import { safePath } from "@/lib/url";

/**
 * Invite link: /r/CODE?to=/series/slug — remembers the inviter for 30 days and opens the page.
 * The code is applied at sign-up (see registerAction).
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const to = safePath(url.searchParams.get("to") ?? "/");
  const res = NextResponse.redirect(new URL(to, url.origin), 302);
  const c = code.trim().toUpperCase();
  if (REF_CODE_RE.test(c)) {
    res.cookies.set(REF_COOKIE, c, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400, secure: process.env.NODE_ENV === "production" });
  }
  return res;
}
