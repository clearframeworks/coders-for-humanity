import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/internal/founder-notifications/route";

test("notification endpoint refuses untrusted requests and fails closed before touching providers", async () => {
  const secretBefore = process.env.CFH_NOTIFICATION_CRON_SECRET;
  const enabledBefore = process.env.CFH_EMAIL_NOTIFICATIONS_ENABLED;
  try {
    delete process.env.CFH_NOTIFICATION_CRON_SECRET;
    const request = (authorization = "") => new Request("https://cfh.retehost.com/api/internal/founder-notifications", { headers: { authorization } });
    assert.equal((await GET(request())).status, 401);
    process.env.CFH_NOTIFICATION_CRON_SECRET = "a".repeat(32);
    process.env.CFH_EMAIL_NOTIFICATIONS_ENABLED = "false";
    assert.equal((await GET(request("Bearer " + "b".repeat(32)))).status, 401);
    // Same JavaScript string length, different byte length: must not throw.
    assert.equal((await GET(request("Bearer " + "é".repeat(32)))).status, 401);
    const disabled = await GET(request("Bearer " + "a".repeat(32)));
    assert.equal(disabled.status, 503);
    assert.deepEqual(await disabled.json(), { status: "not_configured" });
  } finally {
    if (secretBefore === undefined) delete process.env.CFH_NOTIFICATION_CRON_SECRET;
    else process.env.CFH_NOTIFICATION_CRON_SECRET = secretBefore;
    if (enabledBefore === undefined) delete process.env.CFH_EMAIL_NOTIFICATIONS_ENABLED;
    else process.env.CFH_EMAIL_NOTIFICATIONS_ENABLED = enabledBefore;
  }
});
