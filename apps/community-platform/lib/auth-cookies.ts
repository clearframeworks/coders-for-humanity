import type { CookieOptions } from "@supabase/ssr";

export const authCookie = "cfh-auth";
export const pendingRememberCookie = "cfh-pending-remember";
export const sessionOnlyCookie = "cfh-session-only";

export function preferenceCookieOptions(secure: boolean) {
  return { path: "/", httpOnly: true, sameSite: "lax", secure } as const;
}

export function authCookieOptions(
  name: string,
  value: string,
  options: CookieOptions,
  sessionOnly: boolean,
): CookieOptions {
  const isSession = name === authCookie || name.startsWith(`${authCookie}.`);
  if (!sessionOnly || !isSession || !value || options.maxAge === 0) return options;

  // Keep removal writes and PKCE cookies intact. Refreshes must not make
  // a session-only auth cookie persistent again.
  const { maxAge, expires, ...sessionOptions } = options;
  return sessionOptions;
}
