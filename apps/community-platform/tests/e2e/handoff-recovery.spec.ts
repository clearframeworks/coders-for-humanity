import { expect, test } from "@playwright/test";

test("unfinished handoffs recover after reload and replacement is explicit", async ({
  page,
}) => {
  await page.goto("/workspace");
  const title = "A handoff still in progress";
  await page.getByLabel("Handoff title", { exact: true }).fill(title);
  await page
    .getByLabel("Context and objective", { exact: true })
    .fill("This should return after navigating away or reloading.");
  await expect(
    page.getByRole("status").filter({
      hasText: "Unfinished changes are being recovered on this device.",
    }),
  ).toBeVisible();

  await page.goto("/work");
  await page.goto("/workspace");
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    title,
  );
  await page.reload();
  await expect(
    page.getByText(
      "An unfinished handoff was recovered from this browser. Save or export it to keep a copy.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    title,
  );
  await expect(
    page.getByLabel("Context and objective", { exact: true }),
  ).toHaveValue("This should return after navigating away or reloading.");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "New handoff", exact: true }).click();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    title,
  );
  await expect(
    page.getByText("Current handoff kept. No new handoff was opened.", {
      exact: true,
    }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New handoff", exact: true }).click();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "",
  );
  await page.reload();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "",
  );
});

test("recovery for an edited saved note is discarded when that note is deleted", async ({
  page,
}) => {
  await page.goto("/workspace");
  const title = "Saved note with a recovery edit";
  await page.getByLabel("Handoff title", { exact: true }).fill(title);
  await page
    .getByLabel("Context and objective", { exact: true })
    .fill("Original saved context.");
  await page
    .getByRole("button", { name: "Save handoff on this device" })
    .click();

  await page
    .getByLabel("Context and objective", { exact: true })
    .fill("An unfinished edit to the saved note.");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Delete ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Edit ${title}`, exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByText(/An unfinished handoff was recovered from this browser/),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("cfh-handoff-draft:v1")),
  ).toBeNull();
});

test("storage write failures are visible while the current editor remains usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "cfh-handoff-draft:v1") {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }
      originalSetItem.call(this, key, value);
    };
  });
  await page.goto("/workspace");
  await page
    .getByLabel("Handoff title", { exact: true })
    .fill("Still editable");
  await expect(
    page.getByText(
      "The latest edit could not be written to browser recovery storage. An earlier copy may still be restored; export the current fields before leaving this page.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Handoff title", { exact: true })).toHaveValue(
    "Still editable",
  );
});
