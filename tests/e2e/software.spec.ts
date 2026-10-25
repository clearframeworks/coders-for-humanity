import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

test("free software has a dedicated page and a complete download", async ({ page, request }, testInfo) => {
  await page.goto("/software");
  await page.getByRole("link", { name: "Get Your finances" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Know what your money needs to cover.");
  await page.screenshot({ path: testInfo.outputPath("finance-desktop.png"), fullPage: true });
  await expect(page.getByRole("link", { name: "Browse the full source" })).toHaveAttribute("href", /github.com\/clearframeworks\/coders-for-humanity\/tree\/main\/products\/finance-workspace/);
  const link = page.getByRole("link", { name: "Download Your finances (.zip)" });
  const zip = await request.get((await link.getAttribute("href"))!);
  expect(zip.ok()).toBeTruthy();
  const content = await zip.body();
  expect(content.subarray(0, 2).toString()).toBe("PK");
  const checksum = await request.get("/downloads/finance-workspace.sha256");
  expect(checksum.ok()).toBeTruthy();
  expect((await checksum.text()).split(" ")[0]).toBe(createHash("sha256").update(content).digest("hex"));
});

test("mobile software page has no horizontal overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/software/finance-workspace");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("finance-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Free software" })).toBeVisible();
});
