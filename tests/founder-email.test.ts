import test from "node:test";
import assert from "node:assert/strict";
import { dispatchFounderEmail, resendTransport, type FounderEmail, type DeliveryResult } from "../lib/founder-email";

const item: FounderEmail = {
  id: "10000000-0000-4000-8000-000000000001",
  lease_id: "10000000-0000-4000-8000-000000000002",
  recipient_email: "founder@example.invalid",
  sender_email: "notifications@example.invalid",
  subject: "[New CFH contributor] Profile created",
  message: "A contributor created a private CFH profile.",
};

test("worker sends at most one leased event and acknowledges provider acceptance", async () => {
  let claims = 0;
  const finishes: DeliveryResult[] = [];
  const result = await dispatchFounderEmail({
    async claim() { claims++; return item; },
    async finish(got, outcome) { assert.equal(got, item); finishes.push(outcome); },
  }, async () => ({ providerId: "receipt" }));
  assert.equal(claims, 1);
  assert.deepEqual(result, { status: "accepted" });
  assert.deepEqual(finishes, [{ providerId: "receipt" }]);
});

test("empty queue never sends; transport failure is durable and retryable", async () => {
  await dispatchFounderEmail({
    async claim() { return null; },
    async finish() { assert.fail("Cannot acknowledge unclaimed event"); },
  }, async () => { assert.fail("Cannot send without a claimed event"); });
  await dispatchFounderEmail({
    async claim() { return item; },
    async finish(_item, result) { assert.deepEqual(result, { error: "transport_failure", retry: true }); },
  }, async () => { throw new Error("network error with secret body"); });
});

test("Resend transport preserves payload/idempotency across attempts and never records message as sent without receipt", async () => {
  const requests: RequestInit[] = [];
  const mock: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    requests.push(init!);
    return new Response(JSON.stringify({ id: "provider-receipt" }), { status: 200 });
  };
  const send = resendTransport("test-only", mock);
  assert.deepEqual(await send(item), { providerId: "provider-receipt" });
  await send({ ...item, lease_id: "renewed-lease" });
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(new Headers(requests[0].headers).get("Idempotency-Key"), new Headers(requests[1].headers).get("Idempotency-Key"));
  for (const [status, retry] of [[429, true], [503, true], [403, false]] as const) {
    const transport = resendTransport("test-only", async () => new Response("sensitive provider detail", { status }));
    assert.deepEqual(await transport(item), { error: `provider_http_${status}`, retry });
  }
  assert.deepEqual(await resendTransport("test-only", async () => new Response("{}", { status: 200 }))(item), { error: "provider_missing_receipt", retry: true });
});
