import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export const isDemo = () => process.env.CFH_DEMO_MODE === "true";
export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
export async function createClient() {
  if (!configured())
    throw new Error("Supabase is not configured. See README.md.");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server components rely on proxy refresh. */
          }
        },
      },
    },
  );
}
