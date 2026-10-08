import { test, expect } from "@playwright/test";

test("notification worker rejects unauthenticated browser and POST requests", async ({ request }) => {
  for (const method of ["GET", "POST"]) {
    const response = await request.fetch("/api/internal/founder-notifications", { method });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  }
});
