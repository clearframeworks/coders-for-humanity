import { expect, test } from "@playwright/test";

test("a task link preselects a plan without replacing notebook contents", async ({
  page,
}) => {
  await page.goto("/work/cf100000-0000-4000-8000-000000000004");
  await page.getByRole("link", { name: "Plan this task", exact: true }).click();
  await expect(page.getByLabel("Start from a founding task")).toHaveValue(
    "cf100000-0000-4000-8000-000000000004",
  );
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "",
  );
  await page.getByRole("button", { name: "Load task plan", exact: true }).click();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "Task: Write the first human maintainer handoff",
  );
  await page.goto("/workspace?task=not-a-founding-task");
  await expect(page.getByLabel("Start from a founding task")).toHaveValue("");
});

test("founding tasks prefill a local plan and never replace a draft silently", async ({
  page,
}) => {
  await page.goto("/workspace");

  const taskPicker = page.getByLabel("Start from a founding task");
  await taskPicker.selectOption(
    "cf100000-0000-4000-8000-000000000004",
  );
  await expect(
    page.getByRole("link", { name: "Open task context →", exact: true }),
  ).toHaveAttribute("href", "/work/cf100000-0000-4000-8000-000000000004");
  await page.getByRole("button", { name: "Load task plan", exact: true }).click();

  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "Task: Write the first human maintainer handoff",
  );
  await expect(
    page.getByLabel("Context and objective", { exact: true }),
  ).toHaveValue(
    /Task brief: https:\/\/cfh\.retehost\.com\/work\/cf100000-0000-4000-8000-000000000004/,
  );
  await expect(
    page.getByLabel("Context and objective", { exact: true }),
  ).toHaveValue(
    /Objective: Let a new maintainer understand and continue the work/,
  );
  await expect(
    page.getByLabel("Context and objective", { exact: true }),
  ).toHaveValue(
    /Acceptance criteria: A new contributor can identify the current goal/,
  );
  await expect(page.getByLabel("Review needed", { exact: true })).toHaveValue(
    "Project maintainer",
  );

  await page
    .getByLabel("Handoff title", { exact: true })
    .fill("My notes I have not saved");
  await taskPicker.selectOption(
    "cf100000-0000-4000-8000-000000000003",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Load task plan", exact: true }).click();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "My notes I have not saved",
  );
  await expect(
    page.getByText("Current handoff kept. The task plan was not loaded.", {
      exact: true,
    }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Load task plan", exact: true }).click();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "Task: Test the complete contribution journey for accessibility",
  );
  await expect(
    page.getByText("Task plan loaded into an editable draft.", { exact: false }),
  ).toBeVisible();
});
