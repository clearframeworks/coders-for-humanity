import { NextResponse, type NextRequest } from "next/server";
import { createClient, isDemo, configured } from "@/lib/supabase";
import { safeNext } from "@/lib/filters";
export async function GET(request: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url)
    .origin;
  const code = request.nextUrl.searchParams.get("code");
  if (!isDemo() && configured() && code) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeNext(request.nextUrl.searchParams.get("next")), origin),
      );
  }
  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
