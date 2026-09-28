import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("homepage is readable, labelled, and all primary actions work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "worth solving",
  );
  await expect(page.getByText("Demonstration catalogue")).toBeVisible();
  await page
    .getByRole("link", { name: "Explore projects", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByRole("link", { name: "Food Bridge", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Food Bridge",
  );
  await expect(
    page.getByText("No verified outcomes have been published.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("appearance persists and follows the operating system", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(20, 30, 27)",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(252, 252, 248)",
  );
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(20, 30, 27)",
  );
});
test("task filters and board views return the right work", async ({ page }) => {
  await page.goto("/contribute");
  await page.getByLabel("Commitment", { exact: true }).selectOption("< 1 hour");
  await page
    .getByLabel("Discipline", { exact: true })
    .selectOption("Translation");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".task-row")).toHaveCount(1);
  await expect(page.locator(".task-row")).toContainText("plain-language");
  await page.getByRole("link", { name: "Kanban", exact: true }).click();
  await expect(page.locator(".kanban-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Review the plain-language intake guide" })
    .click();
  await expect(
    page.getByText("This is an example task.", { exact: false }),
  ).toBeVisible();
});
test("proposal draft survives reload and duplicate work is suggested", async ({
  page,
}) => {
  await page.goto("/propose");
  await page.getByLabel("Working title").fill("Food Bridge improvements");
  await page
    .getByLabel("Problem (40–10,000 characters)")
    .fill(
      "Local providers need a shared way to coordinate surplus food collections with community organizations.",
    );
  await expect(
    page.getByText("Related work already exists.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Working title")).toHaveValue(
    "Food Bridge improvements",
  );
  await page.getByRole("button", { name: "Next section" }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next section" }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence", exact: true }),
  ).toBeVisible();
});
test("public search and empty financial data remain honest", async ({
  page,
  request,
}) => {
  await page.goto("/search?q=accessibility");
  await expect(page.locator(".search-results")).toContainText("Accessibility");
  const result = await request.get("/api/transparency");
  expect(result.status()).toBe(200);
  expect((await result.json()).status).toBe("no_published_records");
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeDisabled();
});
test("mobile navigation works without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("link", { name: "Programs", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Human problems cross disciplines.",
  );
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
});
for (const theme of ["Light", "Dark"])
  test(`core pages have no automated WCAG A/AA violations in ${theme.toLowerCase()} mode`, async ({
    page,
  }) => {
    for (const path of [
      "/",
      "/contribute",
      "/propose",
      "/projects/access-map",
      "/login",
    ]) {
      await page.goto(path);
      await page.getByRole("button", { name: theme, exact: true }).click();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations,
        `${path}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
      ).toEqual([]);
    }
  });
test("all specified public routes resolve", async ({ request }) => {
  for (const path of [
    "/",
    "/mission",
    "/constitution",
    "/governance",
    "/transparency",
    "/funding",
    "/partners",
    "/about",
    "/programs",
    "/programs/food",
    "/projects",
    "/projects/food-bridge",
    "/contribute",
    "/work",
    "/work/access-labels",
    "/propose",
    "/problems",
    "/problems/food-coordination",
    "/impact",
    "/docs",
    "/docs/lifecycle",
    "/people/example-contributor",
    "/decisions/001",
    "/search",
    "/account",
  ])
    expect((await request.get(path)).status(), path).toBe(200);
  expect((await request.get("/projects/missing")).status()).toBe(404);
});
