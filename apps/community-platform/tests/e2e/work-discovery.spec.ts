import { expect, test } from "@playwright/test";

test("removing an applied filter preserves the remaining filters and view", async ({
  page,
}) => {
  await page.goto(
    "/work?view=Project&discipline=Documentation&level=First%20Contribution",
  );

  await expect(
    page.getByRole("link", { name: "Project", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Remove Discipline: Documentation filter" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Remove Discipline: Documentation filter" })
    .click();

  await expect(page).toHaveURL(/view=Project/);
  await expect(page).toHaveURL(/level=First(?:%20|\+)Contribution/);
  await expect(page).not.toHaveURL(/discipline=/);
  await expect(page.getByLabel("Discipline", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Skill level", { exact: true })).toHaveValue(
    "First Contribution",
  );
  await expect(
    page.getByRole("link", {
      name: "Remove Skill level: First Contribution filter",
    }),
  ).toBeVisible();
});

test("quick filters preserve other filters and the selected view", async ({
  page,
}) => {
  await page.goto("/work?view=Project&status=OPEN");
  await page
    .getByRole("link", { name: "First contribution", exact: true })
    .click();

  await expect(page).toHaveURL(/view=Project/);
  await expect(page).toHaveURL(/status=OPEN/);
  await expect(page).toHaveURL(/level=First(?:%20|\+)Contribution/);
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("OPEN");
  await expect(page.getByLabel("Skill level", { exact: true })).toHaveValue(
    "First Contribution",
  );
  await expect(
    page.getByRole("link", { name: "Project", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("search and filters handle repeated and unknown query values", async ({
  page,
}) => {
  await page.goto(
    "/work?view=unknown&discipline=not-a-discipline&status=unknown&status=OPEN&q=first&q=second&unused=value",
  );

  await expect(page.getByLabel("Find a useful contribution")).toHaveValue(
    "first",
  );
  await expect(page.getByLabel("Find a useful contribution")).toHaveAttribute(
    "maxlength",
    "120",
  );
  await expect(page.getByLabel("Discipline", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("link", { name: "List", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Remove Search: first filter" }),
  ).toBeVisible();
});

test("a long search chip wraps without causing mobile horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const query = "a".repeat(120);
  await page.goto(`/work?q=${query}`);

  await expect(page.getByLabel("Find a useful contribution")).toHaveValue(
    query,
  );
  await expect(
    page.getByRole("link", { name: /^Remove Search:/ }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
