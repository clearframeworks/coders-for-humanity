import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("project memory exports the actual brief as a Markdown attachment", async ({
  page,
  request,
}) => {
  const response = await request.get("/projects/community-platform/brief");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toBe(
    'attachment; filename="community-platform-brief.md"',
  );
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect((await request.get("/projects/missing/brief")).status()).toBe(404);
  await page.goto("/projects/community-platform?tab=knowledge");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download project brief (.md)", exact: true })
    .click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe("community-platform-brief.md");
  const body = await readFile((await file.path())!, "utf8");
  expect(body).toContain("Community platform — contributor brief");
  expect(body).toContain("7 recorded tasks");
  expect(body).toContain("Acceptance criteria");
  expect(body).toContain("https://cfh.retehost.com/work/cf100000-");
});
