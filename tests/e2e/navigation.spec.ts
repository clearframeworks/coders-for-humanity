import { test, expect } from "@playwright/test";

test("search shortcuts work without hijacking typing in a form", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByLabel("Search public information")).toBeFocused();
  await page.getByLabel("Search public information").fill("accessibility");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page.locator(".search-results")).toContainText("accessibility", {
    ignoreCase: true,
  });
  await page.goto("/join");
  await page.getByLabel("Display name (required)").fill("Sam");
  await page.keyboard.press("/");
  await expect(page.getByLabel("Display name (required)")).toHaveValue("Sam/");
  await expect(page).toHaveURL(/\/join$/);
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("Control+k");
  await expect(page).toHaveURL(/\/search$/);
});

test("review queue exposes the real repository without requiring an account", async ({
  page,
}) => {
  await page.goto("/reviews");
  const queue = page.getByRole("region", { name: "Code changes on GitHub" });
  await expect(queue).toBeVisible();
  await expect(
    queue.getByRole("link", { name: /All pull requests/ }),
  ).toHaveAttribute(
    "href",
    "https://github.com/clearframeworks/coders-for-humanity/pulls",
  );
  await expect(queue).toContainText(
    "does not grant approval or release access",
  );
  // Network failures must remain explicit; no synthetic pull request fixtures are shown to users.
  for (const link of await queue.locator(".repository-review-item h3 a").all())
    await expect(link).toHaveAttribute(
      "href",
      /^https:\/\/github.com\/clearframeworks\/coders-for-humanity\/pull\/\d+$/,
    );
});
