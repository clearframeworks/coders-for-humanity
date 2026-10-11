import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("task development explains unavailable accounts without offering a false publish action", async ({ page }) => {
  await page.goto("/work");
  await page.getByRole("link", { name: "Develop a task", exact: true }).click();
  await expect(page).toHaveURL(/\/work\/new$/);
  await expect(page.getByRole("heading", { name: "Turn a need into useful work." })).toBeVisible();
  await expect(page.getByText("Shared task publishing opens when member accounts are connected.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish task", exact: true })).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
});
