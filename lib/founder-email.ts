export type FounderEmail = {
  id: string;
  lease_id: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  message: string;
};
export type DeliveryResult =
  | { providerId: string }
  | { error: string; retry: boolean };
export interface FounderEmailQueue {
  claim(): Promise<FounderEmail | null>;
  finish(item: FounderEmail, result: DeliveryResult): Promise<void>;
}

// One leased message per invocation. A crashed worker leaves its durable lease
// to expire; every attempt keeps the same payload and provider idempotency key.
export async function dispatchFounderEmail(
  queue: FounderEmailQueue,
  send: (item: FounderEmail) => Promise<DeliveryResult>,
) {
  const item = await queue.claim();
  if (!item) return { status: "idle" };
  let result: DeliveryResult;
  try {
    result = await send(item);
  } catch {
    result = { error: "transport_failure", retry: true };
  }
  await queue.finish(item, result);
  return { status: "providerId" in result ? "accepted" : "retry_or_review" };
}

export function resendTransport(apiKey: string, transport: typeof fetch = fetch) {
  return async (item: FounderEmail): Promise<DeliveryResult> => {
    const response = await transport("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `cfh-profile-${item.id}`,
      },
      body: JSON.stringify({
        from: item.sender_email,
        to: [item.recipient_email],
        subject: item.subject,
        text: item.message,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return {
        error: `provider_http_${response.status}`,
        retry: response.status >= 500 || [408, 409, 429].includes(response.status),
      };
    }
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "id" in body && typeof body.id === "string" && body.id.length > 0)
      return { providerId: body.id };
    return { error: "provider_missing_receipt", retry: true };
  };
}
