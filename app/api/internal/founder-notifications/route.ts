import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { dispatchFounderEmail, resendTransport, type FounderEmail } from "@/lib/founder-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CFH_NOTIFICATION_CRON_SECRET;
  const auth = request.headers.get("authorization") || "";
  const actual = Buffer.from(auth);
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const workerToken = process.env.CFH_NOTIFICATION_WORKER_JWT;
  const sender = process.env.CFH_NOTIFICATION_SENDER_EMAIL;
  const emailKey = process.env.CFH_NOTIFICATION_RESEND_API_KEY;
  if (process.env.CFH_EMAIL_NOTIFICATIONS_ENABLED !== "true" || !url || !key || !workerToken || !emailKey || !sender)
    return Response.json({ status: "not_configured" }, { status: 503 });
  // A short-lived scoped JWT authorizes only the two CFH mail RPCs. The shared
  // service-role key and JWT signing secret must never enter this app runtime.
  const db = createClient(url, key, { db: { schema: "cfh" }, global: { headers: { Authorization: `Bearer ${workerToken}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const result = await dispatchFounderEmail({
      async claim() {
        const { data, error } = await db.rpc("claim_founder_email", { sender_input: sender });
        if (error) throw new Error("Queue unavailable");
        return data as FounderEmail | null;
      },
      async finish(item, outcome) {
        const { error } = await db.rpc("finish_founder_email", {
          item_input: item.id,
          lease_input: item.lease_id,
          provider_input: "providerId" in outcome ? outcome.providerId : null,
          error_input: "error" in outcome ? outcome.error : null,
          retry_input: "retry" in outcome && outcome.retry,
        });
        if (error) throw new Error("Queue acknowledgement failed");
      },
    }, resendTransport(emailKey));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Do not expose provider bodies, keys, addresses or database errors.
    return Response.json({ error: "Notification dispatch unavailable" }, { status: 503 });
  }
}
export const POST = GET;
