import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("profile setup validates, previews, restores and clears an unfinished profile", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".topbar")
    .getByRole("link", { name: "Create profile", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Create your profile.",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Display name (required)")).toBeVisible();
  await page.getByLabel("Display name (required)").fill("Sam Rivers");
  await page.getByLabel("Username (required)").fill("sam-rivers");
  await page.getByLabel("Location (optional)").fill("Eastern time");
  await expect(
    page.getByRole("complementary", { name: "Live profile preview" }),
  ).toContainText("Sam Rivers");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("What would you like to contribute?")
    .fill("I can help with accessibility testing and documentation.");
  await page
    .getByLabel("Availability (optional)")
    .fill("Two hours on weekends");
  await page
    .getByLabel("Website or portfolio (optional)")
    .fill("http://example.org");
  await page
    .getByRole("button", { name: "Preview profile", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Profile setup" }).getByRole("alert"),
  ).toBeVisible();
  await page
    .getByLabel("Website or portfolio (optional)")
    .fill("https://example.org");
  await page
    .getByRole("button", { name: "Preview profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review & join", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await page.reload();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.locator(".profile-review")).toContainText(
    "Two hours on weekends",
  );
  await expect(page.locator(".profile-review")).toContainText(
    "https://example.org",
  );
  await expect(
    page.getByRole("heading", {
      name: "Your draft is ready. Registration isn’t open yet.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create profile", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByLabel("What would you like to contribute?"),
  ).toHaveValue(/accessibility testing/);
  await page.getByRole("button", { name: "Clear draft", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Display name (required)")).toHaveValue("");
});

test("photography loads locally and signup stays accessible on small screens", async ({
  page,
}) => {
  for (const path of ["/", "/projects", "/programs", "/join"]) {
    await page.goto(path);
    const photo = page.locator(".editorial-photo img").first();
    await expect(photo).toBeVisible();
    await expect
      .poll(() =>
        photo.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(await photo.getAttribute("src")).toContain("%2Fphotos%2F");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/join", "/programs", "/photo-credits"]) {
    await page.goto(path);
    await expect(
      page
        .locator(".topbar")
        .getByRole("link", { name: "Create profile", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
  }
});

for (const theme of ["Light", "Dark"])
  test(`profile steps and photo cards pass accessibility checks in ${theme} mode`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto("/join");
    await page.getByRole("button", { name: theme, exact: true }).click();
    const check = async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    };
    await check();
    await page.getByLabel("Display name (required)").fill("Sam");
    await page.getByLabel("Username (required)").fill("sam-rivers");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await check();
    await page
      .getByRole("button", { name: "Preview profile", exact: true })
      .click();
    await check();
    await page.goto("/programs");
    await check();
  });
