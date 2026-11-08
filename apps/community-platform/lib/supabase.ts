import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authCookie, authCookieOptions, sessionOnlyCookie } from "./auth-cookies";
export const isDemo = () => process.env.CFH_DEMO_MODE === "true";
export const githubAuthEnabled = () =>
  process.env.CFH_GITHUB_AUTH_ENABLED === "true";
export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
export async function createClient(sessionOnly?: boolean) {
  if (!configured())
    throw new Error("Supabase is not configured. See README.md.");
  const jar = await cookies();
  const useSessionCookies = sessionOnly ?? jar.get(sessionOnlyCookie)?.value === "1";
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: "cfh" },
      cookieOptions: { name: authCookie },
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, authCookieOptions(name, value, options, useSessionCookies)),
            );
          } catch {
            /* Server components rely on proxy refresh. */
          }
        },
      },
    },
  );
}
