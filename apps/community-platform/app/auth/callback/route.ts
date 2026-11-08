import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient, isDemo, configured } from "@/lib/supabase";
import { callbackFailurePath, safeNext } from "@/lib/filters";
import { pendingRememberCookie, preferenceCookieOptions, sessionOnlyCookie } from "@/lib/auth-cookies";
export async function GET(request: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url)
    .origin;
  const code = request.nextUrl.searchParams.get("code");
  if (!isDemo() && configured() && code) {
    const jar = await cookies();
    const sessionOnly = jar.get(pendingRememberCookie)?.value !== "1";
    const db = await createClient(sessionOnly);
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const options = preferenceCookieOptions(origin.startsWith("https:"));
      if (sessionOnly) jar.set(sessionOnlyCookie, "1", options);
      else jar.set(sessionOnlyCookie, "", { ...options, maxAge: 0 });
      jar.set(pendingRememberCookie, "", { ...options, maxAge: 0 });
      return NextResponse.redirect(
        new URL(safeNext(request.nextUrl.searchParams.get("next")), origin),
      );
    }
  }
  return NextResponse.redirect(
    new URL(
      callbackFailurePath(request.nextUrl.searchParams.get("next")),
      origin,
    ),
  );
}
